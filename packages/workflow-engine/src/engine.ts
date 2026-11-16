import { validateWorkflow, type WorkflowDefinition, type WorkflowNode } from "@nexus-flow/workflow-schema";
import { createExecutionPlan } from "./planner.js";
import { NodeRegistry } from "./registry.js";
import {
  WorkflowExecutionError,
  type ExecutionRequest,
  type NodeExecutionContext,
  type NodeExecutionResult,
  type NodeInput,
  type NodeOutput,
  type WorkflowExecutionResult
} from "./types.js";

const noopLogger: NodeExecutionContext["log"] = () => {};

function errorInfo(error: unknown): { name: string; message: string } {
  if (error instanceof Error) return { name: error.name, message: error.message };
  return { name: "Error", message: String(error) };
}

function resolveInputs(
  node: WorkflowNode,
  workflow: WorkflowDefinition,
  outputs: Record<string, NodeOutput>,
  initialInput: unknown
): NodeInput {
  const inputs: NodeInput = {};
  if (node.category === "trigger") inputs.input = initialInput;

  const incoming = workflow.edges.filter((edge) => edge.target === node.id && (edge.type !== "conditional" || Boolean(outputs[edge.source]?.[edge.sourceHandle])));
  const connectedPorts = new Set<string>();

  for (const edge of incoming) {
    if (connectedPorts.has(edge.targetHandle)) {
      throw new WorkflowExecutionError(
        `Input port "${edge.targetHandle}" on node "${node.id}" has multiple incoming connections`,
        "MULTIPLE_INPUT_CONNECTIONS",
        node.id
      );
    }
    connectedPorts.add(edge.targetHandle);
    const sourceOutput = outputs[edge.source];
    if (!sourceOutput || !Object.hasOwn(sourceOutput, edge.sourceHandle)) {
      throw new WorkflowExecutionError(
        `Source output "${edge.sourceHandle}" is missing on node "${edge.source}"`,
        "MISSING_OUTPUT",
        node.id
      );
    }
    inputs[edge.targetHandle] = sourceOutput[edge.sourceHandle];
  }

  for (const port of node.inputs) {
    if (port.required && !Object.hasOwn(inputs, port.id)) {
      throw new WorkflowExecutionError(
        `Required input "${port.id}" was not provided to node "${node.id}"`,
        "REQUIRED_INPUT_MISSING",
        node.id
      );
    }
  }
  return inputs;
}

function validatePortValues(node: WorkflowNode, direction: "inputs" | "outputs", values: Record<string, unknown>): void {
  for (const port of node[direction]) {
    const present = Object.hasOwn(values, port.id);
    if (!present) {
      if (direction === "inputs" && port.required) throw new WorkflowExecutionError(`Required input "${port.id}" is missing`, "REQUIRED_INPUT_MISSING", node.id);
      continue;
    }
    const value = values[port.id];
    const valid = port.dataType === "any" ||
      (port.dataType === "string" && typeof value === "string") ||
      (port.dataType === "number" && typeof value === "number" && Number.isFinite(value)) ||
      (port.dataType === "boolean" && typeof value === "boolean") ||
      (port.dataType === "array" && Array.isArray(value)) ||
      (port.dataType === "object" && value !== null && typeof value === "object" && !Array.isArray(value));
    if (!valid) throw new WorkflowExecutionError(`Port "${port.id}" expected ${port.dataType}`, "PORT_TYPE_MISMATCH", node.id);
  }
}
export class WorkflowEngine {
  constructor(private readonly registry: NodeRegistry) {}

  async execute(request: ExecutionRequest): Promise<WorkflowExecutionResult> {
    const startedAt = new Date().toISOString();
    const { workflow, executionId } = request;
    const validation = validateWorkflow(workflow);
    if (!validation.valid) {
      throw new WorkflowExecutionError(
        `Workflow validation failed: ${validation.issues.map((issue) => issue.message).join("; ")}`,
        "INVALID_WORKFLOW"
      );
    }

    const plan = createExecutionPlan(validation.workflow ?? workflow);
    const maxConcurrency = Math.max(1, Math.min(100, request.maxConcurrency ?? workflow.settings.maxConcurrency));
    const controller = new AbortController();
    const signal = request.signal
      ? AbortSignal.any([request.signal, controller.signal])
      : controller.signal;
    const logger = request.logger ?? noopLogger;
    const outputs: Record<string, NodeOutput> = {};
    const nodeResults: NodeExecutionResult[] = [];
    const nodeById = new Map(workflow.nodes.map((node) => [node.id, node]));

    const cancelledResult = (): WorkflowExecutionResult => ({
      executionId,
      workflowId: workflow.id,
      workflowVersion: workflow.version,
      status: "cancelled",
      startedAt,
      finishedAt: new Date().toISOString(),
      nodes: nodeResults,
      outputs
    });

    for (const layer of plan) {
      if (signal.aborted) return cancelledResult();

      for (let offset = 0; offset < layer.length; offset += maxConcurrency) {
        const batch = layer.slice(offset, offset + maxConcurrency);
        const settled = await Promise.all(batch.map(async (node) => {
          const nodeStartedAt = new Date().toISOString();
          try {
            if (signal.aborted) throw new WorkflowExecutionError("Execution cancelled", "CANCELLED", node.id);
            const incoming = workflow.edges.filter((edge) => edge.target === node.id);
            const skippedUpstream = incoming.some((edge) => edge.type === "default" && nodeResults.some((result) => result.nodeId === edge.source && result.status === "skipped"));
            const conditionalIncoming = incoming.filter((edge) => edge.type === "conditional");
            const hasActiveConditional = conditionalIncoming.some((edge) => Boolean(outputs[edge.source]?.[edge.sourceHandle]));
            if (skippedUpstream || (conditionalIncoming.length > 0 && !hasActiveConditional)) {
              return { node, result: { nodeId: node.id, status: "skipped" as const, startedAt: nodeStartedAt, finishedAt: new Date().toISOString() } };
            }
            const executor = this.registry.get(node.type);
            const input = resolveInputs(node, workflow, outputs, request.input);
            validatePortValues(node, "inputs", input);
            const context: NodeExecutionContext = {
              executionId,
              workflowId: workflow.id,
              workflowVersion: workflow.version,
              nodeId: node.id,
              signal,
              log: (level, message, data) => logger(level, message, { nodeId: node.id, ...data })
            };
            const output = await executor({ node, input, config: node.config, context });
            if (!output || typeof output !== "object" || Array.isArray(output)) throw new WorkflowExecutionError("Node executor must return an output object", "INVALID_NODE_OUTPUT", node.id);
            validatePortValues(node, "outputs", output);
            if (signal.aborted) throw new WorkflowExecutionError("Execution cancelled", "CANCELLED", node.id);
            return {
              node,
              result: {
                nodeId: node.id,
                status: "completed" as const,
                output,
                startedAt: nodeStartedAt,
                finishedAt: new Date().toISOString()
              }
            };
          } catch (error) {
            return {
              node,
              result: {
                nodeId: node.id,
                status: signal.aborted ? "cancelled" as const : "failed" as const,
                error: errorInfo(error),
                startedAt: nodeStartedAt,
                finishedAt: new Date().toISOString()
              }
            };
          }
        }));

        for (const item of settled) {
          nodeResults.push(item.result);
          if (item.result.status === "completed" && item.result.output) {
            outputs[item.node.id] = item.result.output;
          }
        }

        const failed = settled.find((item) => item.result.status === "failed");
        if (failed) {
          controller.abort();
          const info = failed.result.error ?? { name: "Error", message: "Node failed" };
          return {
            executionId,
            workflowId: workflow.id,
            workflowVersion: workflow.version,
            status: "failed",
            startedAt,
            finishedAt: new Date().toISOString(),
            nodes: nodeResults,
            outputs,
            error: { ...info, nodeId: failed.node.id }
          };
        }
        if (signal.aborted || settled.some((item) => item.result.status === "cancelled")) {
          return cancelledResult();
        }
      }
    }

    return {
      executionId,
      workflowId: workflow.id,
      workflowVersion: workflow.version,
      status: "completed",
      startedAt,
      finishedAt: new Date().toISOString(),
      nodes: nodeResults,
      outputs
    };
  }
}
