import {
  workflowSchema,
  type WorkflowDefinition,
  type WorkflowNode,
  type WorkflowPort
} from "./schema.js";

export interface ValidationIssue {
  code: string;
  message: string;
  path?: string;
}

export interface WorkflowValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  workflow?: WorkflowDefinition;
}

function uniqueById<T extends { id: string }>(
  values: T[],
  kind: string,
  issues: ValidationIssue[]
): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value.id)) {
      issues.push({ code: "DUPLICATE_ID", message: `Duplicate ${kind} id: ${value.id}` });
    }
    seen.add(value.id);
  }
}

function findPort(node: WorkflowNode, direction: "inputs" | "outputs", id: string): WorkflowPort | undefined {
  return node[direction].find((port) => port.id === id);
}

export function validateWorkflow(input: unknown): WorkflowValidationResult {
  const parsed = workflowSchema.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      issues: parsed.error.issues.map((issue) => ({
        code: "SCHEMA_VALIDATION",
        message: issue.message,
        path: issue.path.join(".")
      }))
    };
  }

  const workflow = parsed.data;
  const issues: ValidationIssue[] = [];
  uniqueById(workflow.nodes, "node", issues);
  uniqueById(workflow.edges, "edge", issues);

  const nodes = new Map(workflow.nodes.map((node) => [node.id, node]));

  for (const node of workflow.nodes) {
    uniqueById(node.inputs, `input port on node ${node.id}`, issues);
    uniqueById(node.outputs, `output port on node ${node.id}`, issues);
  }

  for (const edge of workflow.edges) {
    const source = nodes.get(edge.source);
    const target = nodes.get(edge.target);
    if (!source || !target) {
      issues.push({
        code: "MISSING_NODE",
        message: `Edge ${edge.id} references a missing source or target node`
      });
      continue;
    }

    const output = findPort(source, "outputs", edge.sourceHandle);
    const inputPort = findPort(target, "inputs", edge.targetHandle);
    if (!output || !inputPort) {
      issues.push({
        code: "MISSING_PORT",
        message: `Edge ${edge.id} references a missing source or target port`
      });
      continue;
    }

    if (output.dataType !== "any" && inputPort.dataType !== "any" && output.dataType !== inputPort.dataType) {
      issues.push({
        code: "INCOMPATIBLE_PORT_TYPES",
        message: `Edge ${edge.id} connects ${output.dataType} to ${inputPort.dataType}`
      });
    }
  }

  return { valid: issues.length === 0, issues, workflow };
}

export function serializeWorkflow(workflow: WorkflowDefinition): string {
  return JSON.stringify(workflow, null, 2);
}

export function deserializeWorkflow(json: string): WorkflowValidationResult {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return {
      valid: false,
      issues: [{ code: "INVALID_JSON", message: "Workflow document is not valid JSON" }]
    };
  }
  return validateWorkflow(value);
}
