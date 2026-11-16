import type { WorkflowDefinition, WorkflowNode } from "@nexus-flow/workflow-schema";

export type NodeOutput = Record<string, unknown>;
export type NodeInput = Record<string, unknown>;

export interface NodeExecutionContext {
  executionId: string;
  workflowId: string;
  workflowVersion: number;
  nodeId: string;
  signal: AbortSignal;
  log: (level: "debug" | "info" | "warn" | "error", message: string, data?: Record<string, unknown>) => void;
}

export interface NodeExecutionRequest {
  node: WorkflowNode;
  input: NodeInput;
  config: Record<string, unknown>;
  context: NodeExecutionContext;
}

export type NodeExecutor = (request: NodeExecutionRequest) => Promise<NodeOutput> | NodeOutput;

export interface ExecutionRequest {
  workflow: WorkflowDefinition;
  executionId: string;
  input?: unknown;
  signal?: AbortSignal;
  maxConcurrency?: number;
  logger?: NodeExecutionContext["log"];
}

export interface NodeExecutionResult {
  nodeId: string;
  status: "completed" | "failed" | "cancelled";
  output?: NodeOutput;
  error?: { name: string; message: string };
  startedAt: string;
  finishedAt: string;
}

export interface WorkflowExecutionResult {
  executionId: string;
  workflowId: string;
  workflowVersion: number;
  status: "completed" | "failed" | "cancelled";
  startedAt: string;
  finishedAt: string;
  nodes: NodeExecutionResult[];
  outputs: Record<string, NodeOutput>;
  error?: { name: string; message: string; nodeId?: string };
}

export class WorkflowExecutionError extends Error {
  readonly code: string;
  readonly nodeId?: string;

  constructor(message: string, code: string, nodeId?: string) {
    super(message);
    this.name = "WorkflowExecutionError";
    this.code = code;
    if (nodeId !== undefined) this.nodeId = nodeId;
  }
}
