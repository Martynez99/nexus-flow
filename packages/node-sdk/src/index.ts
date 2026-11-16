import { z } from "zod";
import type { WorkflowPort } from "@nexus-flow/workflow-schema";
import type { NodeExecutionRequest, NodeExecutor } from "@nexus-flow/workflow-engine";
import { WorkflowExecutionError } from "@nexus-flow/workflow-engine";

export interface NodeDefinition {
  type: string;
  name: string;
  category: "trigger" | "action" | "logic" | "data" | "ai" | "code" | "integration";
  description: string;
  inputs: WorkflowPort[];
  outputs: WorkflowPort[];
  configSchema: z.ZodType<Record<string, unknown>>;
  execute: NodeExecutor;
}

export function defineNode<T extends z.ZodType<Record<string, unknown>>>(
  definition: Omit<NodeDefinition, "configSchema"> & { configSchema: T }
): NodeDefinition {
  return definition;
}

export function registerNodeDefinitions(
  registry: { register(type: string, executor: NodeExecutor): unknown },
  definitions: NodeDefinition[]
): void {
  for (const definition of definitions) {
    registry.register(definition.type, async (request: NodeExecutionRequest) => {
      const parsed = definition.configSchema.safeParse(request.config);
      if (!parsed.success) {
        throw new WorkflowExecutionError(
          `Invalid configuration for ${definition.type}: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`,
          "INVALID_NODE_CONFIG",
          request.node.id
        );
      }
      return definition.execute({ ...request, config: parsed.data });
    });
  }
}

export function port(
  id: string,
  name: string,
  dataType: WorkflowPort["dataType"] = "any",
  required = false,
  description?: string
): WorkflowPort {
  return { id, name, dataType, required, ...(description ? { description } : {}) };
}

export { z };
