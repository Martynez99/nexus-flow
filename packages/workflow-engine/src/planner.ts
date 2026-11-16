import type { WorkflowDefinition, WorkflowNode } from "@nexus-flow/workflow-schema";
import { WorkflowExecutionError } from "./types.js";

export function createExecutionPlan(workflow: WorkflowDefinition): WorkflowNode[][] {
  const nodes = new Map(workflow.nodes.map((node) => [node.id, node]));
  const indegree = new Map(workflow.nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(workflow.nodes.map((node) => [node.id, [] as string[]]));

  for (const edge of workflow.edges) {
    if (edge.type !== "default") {
      throw new WorkflowExecutionError(
        `Edge type "${edge.type}" is not supported by this execution engine yet`,
        "UNSUPPORTED_EDGE_TYPE"
      );
    }
    if (!nodes.has(edge.source) || !nodes.has(edge.target)) {
      throw new WorkflowExecutionError(`Edge ${edge.id} references a missing node`, "INVALID_EDGE");
    }
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    outgoing.get(edge.source)?.push(edge.target);
  }

  const plan: WorkflowNode[][] = [];
  let ready = workflow.nodes.filter((node) => indegree.get(node.id) === 0).sort((a, b) => a.id.localeCompare(b.id));
  let visited = 0;

  while (ready.length > 0) {
    const layer = ready;
    plan.push(layer);
    visited += layer.length;
    const next: WorkflowNode[] = [];

    for (const node of layer) {
      for (const targetId of outgoing.get(node.id) ?? []) {
        const remaining = (indegree.get(targetId) ?? 0) - 1;
        indegree.set(targetId, remaining);
        if (remaining === 0) {
          const target = nodes.get(targetId);
          if (target) next.push(target);
        }
      }
    }
    ready = next.sort((a, b) => a.id.localeCompare(b.id));
  }

  if (visited !== workflow.nodes.length) {
    throw new WorkflowExecutionError("Workflow contains a cycle; cyclic execution is not supported yet", "CYCLE_DETECTED");
  }
  return plan;
}
