import { describe, expect, it } from "vitest";
import { deserializeWorkflow, validateWorkflow } from "./index.js";

const validWorkflow: any = {
  id: "wf-hello",
  name: "Hello workflow",
  version: 1,
  nodes: [
    {
      id: "trigger",
      type: "manual.trigger",
      name: "Manual trigger",
      category: "trigger",
      position: { x: 0, y: 0 },
      outputs: [{ id: "payload", name: "Payload", dataType: "object" }]
    },
    {
      id: "log",
      type: "core.log",
      name: "Log",
      category: "action",
      position: { x: 240, y: 0 },
      inputs: [{ id: "value", name: "Value", dataType: "object" }]
    }
  ],
  edges: [
    {
      id: "edge-1",
      source: "trigger",
      sourceHandle: "payload",
      target: "log",
      targetHandle: "value"
    }
  ]
};

describe("workflow validation", () => {
  it("accepts a structurally valid workflow", () => {
    expect(validateWorkflow(validWorkflow).valid).toBe(true);
  });

  it("rejects duplicate node ids", () => {
    const input = structuredClone(validWorkflow);
    input.nodes[1].id = "trigger";
    expect(validateWorkflow(input).issues.some((issue) => issue.code === "DUPLICATE_ID")).toBe(true);
  });

  it("rejects missing node references", () => {
    const input = structuredClone(validWorkflow);
    input.edges[0].target = "missing";
    expect(validateWorkflow(input).issues.some((issue) => issue.code === "MISSING_NODE")).toBe(true);
  });

  it("rejects incompatible port types", () => {
    const input = structuredClone(validWorkflow);
    input.nodes[1].inputs[0].dataType = "string";
    expect(validateWorkflow(input).issues.some((issue) => issue.code === "INCOMPATIBLE_PORT_TYPES")).toBe(true);
  });

  it("accepts configured dynamic output handles", () => {
    const input = structuredClone(validWorkflow);
    input.nodes[0].outputs = [{ id: "*", name: "Dynamic output", dataType: "boolean", dynamic: true }];
    input.nodes[1].inputs[0].dataType = "boolean";
    input.edges[0].sourceHandle = "ready";
    input.edges[0].type = "conditional";
    expect(validateWorkflow(input).valid).toBe(true);
  });
  it("returns a useful error for malformed JSON", () => {
    expect(deserializeWorkflow("{").issues[0]?.code).toBe("INVALID_JSON");
  });
});
