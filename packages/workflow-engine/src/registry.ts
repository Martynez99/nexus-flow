import type { NodeExecutor } from "./types.js";
import { WorkflowExecutionError } from "./types.js";

export class NodeRegistry {
  private readonly executors = new Map<string, NodeExecutor>();

  register(type: string, executor: NodeExecutor): this {
    if (!type.trim()) throw new WorkflowExecutionError("Node type cannot be empty", "INVALID_NODE_TYPE");
    if (this.executors.has(type)) {
      throw new WorkflowExecutionError(`Executor already registered for node type: ${type}`, "DUPLICATE_EXECUTOR");
    }
    this.executors.set(type, executor);
    return this;
  }

  replace(type: string, executor: NodeExecutor): this {
    if (!type.trim()) throw new WorkflowExecutionError("Node type cannot be empty", "INVALID_NODE_TYPE");
    this.executors.set(type, executor);
    return this;
  }

  get(type: string): NodeExecutor {
    const executor = this.executors.get(type);
    if (!executor) {
      throw new WorkflowExecutionError(`No executor registered for node type: ${type}`, "UNKNOWN_NODE_TYPE");
    }
    return executor;
  }

  has(type: string): boolean {
    return this.executors.has(type);
  }

  list(): string[] {
    return [...this.executors.keys()].sort();
  }
}
