import { describe, expect, it } from "vitest";
import { WorkflowEngine } from "./engine.js";
import { NodeRegistry } from "./registry.js";
import { createExecutionPlan } from "./planner.js";
import { WorkflowExecutionError } from "./types.js";
import type { WorkflowDefinition, WorkflowNode } from "@nexus-flow/workflow-schema";

const node = (
  id: string,
  type = id,
  category: "trigger" | "action" = "action",
  inputs: { id: string; name: string; dataType: "any"; required?: boolean }[] = [],
  outputs: { id: string; name: string; dataType: "any"; required?: boolean }[] = []
): WorkflowNode => ({
  id,
  type,
  name: id,
  category,
  position: { x: 0, y: 0 },
  inputs: inputs.map((port) => ({ ...port, required: port.required ?? false })),
  outputs: outputs.map((port) => ({ ...port, required: port.required ?? false })),
  config: {}
});

const workflow = (nodes: WorkflowNode[], edges: WorkflowDefinition["edges"] = []): WorkflowDefinition => ({
  id: "wf-test", name: "Test workflow", description: "", version: 1, nodes, edges,
  settings: { timeoutMs: 300000, retries: 0, maxConcurrency: 4 }
});

describe("workflow execution engine", () => {
  it("builds a deterministic topological plan", () => {
    const definition = workflow([node("c"), node("b"), node("a")], [
      { id: "ab", source: "a", sourceHandle: "out", target: "b", targetHandle: "in", type: "default" },
      { id: "bc", source: "b", sourceHandle: "out", target: "c", targetHandle: "in", type: "default" }
    ]);
    expect(createExecutionPlan(definition).map((layer) => layer.map((item) => item.id))).toEqual([["a"], ["b"], ["c"]]);
  });

  it("rejects cyclic graphs", () => {
    const definition = workflow([node("a"), node("b")], [
      { id: "ab", source: "a", sourceHandle: "out", target: "b", targetHandle: "in", type: "default" },
      { id: "ba", source: "b", sourceHandle: "out", target: "a", targetHandle: "in", type: "default" }
    ]);
    expect(() => createExecutionPlan(definition)).toThrowError(WorkflowExecutionError);
  });

  it("passes upstream output into the downstream input", async () => {
    const definition = workflow([
      node("trigger", "manual.trigger", "trigger", [], [{ id: "payload", name: "Payload", dataType: "any" }]),
      node("upper", "text.upper", "action", [{ id: "value", name: "Value", dataType: "any", required: true }], [{ id: "result", name: "Result", dataType: "any" }])
    ], [{ id: "edge-1", source: "trigger", sourceHandle: "payload", target: "upper", targetHandle: "value", type: "default" }]);

    const registry = new NodeRegistry()
      .register("manual.trigger", ({ input }) => ({ payload: input.input }))
      .register("text.upper", ({ input }) => ({ result: String(input.value).toUpperCase() }));

    const result = await new WorkflowEngine(registry).execute({
      workflow: definition, executionId: "exec-1", input: "hello"
    });

    expect(result.status).toBe("completed");
    expect(result.outputs.upper?.result).toBe("HELLO");
    expect(result.nodes).toHaveLength(2);
  });

  it("fails clearly for an unregistered node", async () => {
    const definition = workflow([node("unknown", "missing.executor")]);
    const result = await new WorkflowEngine(new NodeRegistry()).execute({
      workflow: definition, executionId: "exec-2"
    });
    expect(result.status).toBe("failed");
    expect(result.error?.message).toContain("missing.executor");
  });

  it("stops downstream execution after a node failure", async () => {
    const definition = workflow([
      node("first", "first", "action", [], [{ id: "out", name: "Output", dataType: "any" }]),
      node("second", "second", "action", [{ id: "in", name: "Input", dataType: "any" }])
    ], [
      { id: "edge", source: "first", sourceHandle: "out", target: "second", targetHandle: "in", type: "default" }
    ]);
    const registry = new NodeRegistry()
      .register("first", () => { throw new Error("boom"); })
      .register("second", () => ({ ok: true }));
    const result = await new WorkflowEngine(registry).execute({ workflow: definition, executionId: "exec-3" });
    expect(result.status).toBe("failed");
    expect(result.nodes.map((item) => item.nodeId)).toEqual(["first"]);
  });

  it("runs only the active conditional branch", async () => {
    const definition = workflow([
      node("condition", "condition", "action", [], [{ id: "yes", name: "Yes", dataType: "any" }, { id: "no", name: "No", dataType: "any" }]),
      node("yes-branch", "branch.yes", "action", [{ id: "in", name: "Input", dataType: "any" }]),
      node("no-branch", "branch.no", "action", [{ id: "in", name: "Input", dataType: "any" }])
    ], [
      { id: "yes-edge", source: "condition", sourceHandle: "yes", target: "yes-branch", targetHandle: "in", type: "conditional" },
      { id: "no-edge", source: "condition", sourceHandle: "no", target: "no-branch", targetHandle: "in", type: "conditional" }
    ]);
    const registry = new NodeRegistry()
      .register("condition", () => ({ yes: true, no: false }))
      .register("branch.yes", () => ({ ran: true }))
      .register("branch.no", () => ({ ran: true }));
    const result = await new WorkflowEngine(registry).execute({ workflow: definition, executionId: "exec-branch" });
    expect(result.status).toBe("completed");
    expect(result.nodes.find((item) => item.nodeId === "yes-branch")?.status).toBe("completed");
    expect(result.nodes.find((item) => item.nodeId === "no-branch")?.status).toBe("skipped");
  });
  it("supports cancellation before execution begins", async () => {
    const definition = workflow([node("first")]);
    const controller = new AbortController();
    controller.abort();
    const result = await new WorkflowEngine(new NodeRegistry().register("first", () => ({}))).execute({
      workflow: definition, executionId: "exec-4", signal: controller.signal
    });
    expect(result.status).toBe("cancelled");
  });
});
