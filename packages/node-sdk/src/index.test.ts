import { describe, expect, it } from "vitest";
import { defineNode, port, z } from "./index.js";

describe("node SDK", () => {
  it("creates typed node definitions", () => {
    const node = defineNode({
      type: "example.echo", name: "Echo", category: "action", description: "Echo input",
      inputs: [port("value", "Value", "string", true)],
      outputs: [port("value", "Value", "string")],
      configSchema: z.object({ prefix: z.string().default("") }).passthrough(),
      execute: ({ input, config }) => ({ value: `${String(config.prefix)}${String(input.value ?? "")}` })
    });
    expect(node.type).toBe("example.echo");
    expect(node.configSchema.parse({}).prefix).toBe("");
  });

  it("preserves optional port descriptions", () => {
    expect(port("id", "Identifier", "string", true, "Unique identifier")).toEqual({
      id: "id", name: "Identifier", dataType: "string", required: true, description: "Unique identifier"
    });
  });
});
