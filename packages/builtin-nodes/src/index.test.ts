import { describe, expect, it, vi } from "vitest";
import { builtInNodes, createHttpRequestNode } from "./index.js";

const get = (type: string) => {
  const node = builtInNodes.find((item) => item.type === type);
  if (!node) throw new Error(`Missing built-in node: ${type}`);
  return node;
};

function request(type: string, input: Record<string, unknown>, config: Record<string, unknown> = {}) {
  const definition = get(type);
  const parsed = definition.configSchema.parse(config);
  const log = vi.fn();
  return definition.execute({
    node: { id: "node-1", type, name: type, category: definition.category, position: { x: 0, y: 0 }, inputs: definition.inputs, outputs: definition.outputs, config: parsed },
    input, config: parsed,
    context: { executionId: "exec-1", workflowId: "wf-1", workflowVersion: 1, nodeId: "node-1", signal: new AbortController().signal, log }
  });
}

describe("built-in nodes", () => {
  it("ships the complete initial node catalog", () => {
    expect(builtInNodes.map((node) => node.type)).toEqual(expect.arrayContaining([
      "trigger.manual", "trigger.webhook", "trigger.schedule",
      "data.set", "data.transform", "data.merge", "data.filter",
      "logic.if", "logic.switch", "logic.delay",
      "action.logger", "action.json.parse", "http.request"
    ]));
  });

  it("sets object fields", async () => {
    await expect(request("data.set", { input: { a: 1 } }, { values: { b: 2 } })).resolves.toEqual({ value: { a: 1, b: 2 } });
  });

  it("transforms dotted paths", async () => {
    await expect(request("data.transform", { input: { user: { name: "Ada" } } }, { mappings: { displayName: "user.name" } })).resolves.toEqual({ value: { displayName: "Ada" } });
  });

  it("filters arrays", async () => {
    await expect(request("data.filter", { items: [{ score: 2 }, { score: 8 }] }, { field: "score", operator: "greater-than", value: 4 })).resolves.toEqual({ items: [{ score: 8 }], count: 1 });
  });

  it("evaluates if/else outputs", async () => {
    await expect(request("logic.if", { input: { score: 8 } }, { field: "score", operator: "greater-than", value: 4 })).resolves.toEqual({ true: true, false: false, condition: true });
  });

  it("routes switch values", async () => {
    await expect(request("logic.switch", { input: { status: "ready" } }, { field: "status", cases: [{ value: "ready", handle: "ready" }] })).resolves.toEqual({ ready: true });
  });

  it("parses JSON", async () => {
    await expect(request("action.json.parse", { input: '{"ok":true}' })).resolves.toEqual({ value: { ok: true } });
  });

  it("blocks private-network HTTP targets", async () => {
    const node = createHttpRequestNode(vi.fn() as unknown as typeof fetch);
    const parsed = node.configSchema.parse({ url: "http://127.0.0.1/admin" });
    await expect(node.execute({
      node: { id: "http", type: node.type, name: node.name, category: node.category, position: { x: 0, y: 0 }, inputs: node.inputs, outputs: node.outputs, config: parsed },
      input: {}, config: parsed,
      context: { executionId: "e", workflowId: "w", workflowVersion: 1, nodeId: "http", signal: new AbortController().signal, log: () => {} }
    })).rejects.toThrow(/blocked/);
  });

  it("returns response metadata from HTTP", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200, headers: { "content-type": "application/json" } }));
    const node = createHttpRequestNode(fetcher as unknown as typeof fetch);
    const parsed = node.configSchema.parse({ url: "https://example.com/api" });
    const output = await node.execute({
      node: { id: "http", type: node.type, name: node.name, category: node.category, position: { x: 0, y: 0 }, inputs: node.inputs, outputs: node.outputs, config: parsed },
      input: {}, config: parsed,
      context: { executionId: "e", workflowId: "w", workflowVersion: 1, nodeId: "http", signal: new AbortController().signal, log: () => {} }
    });
    expect(output.status).toBe(200);
    expect(output.data).toEqual({ ok: true });
  });
});
