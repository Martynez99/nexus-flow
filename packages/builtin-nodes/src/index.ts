import { defineNode, port, z, type NodeDefinition } from "@nexus-flow/node-sdk";

const emptyConfig = z.record(z.string(), z.unknown());
const manualConfig = z.object({}).passthrough();
const webhookConfig = z.object({}).passthrough();
const scheduleConfig = z.object({
  cron: z.string().min(1),
  timezone: z.string().default("UTC")
}).passthrough();
const setConfig = z.object({
  values: z.record(z.string(), z.unknown()).default({})
}).passthrough();
const transformConfig = z.object({
  mappings: z.record(z.string(), z.string()).default({})
}).passthrough();
const mergeConfig = z.object({
  strategy: z.enum(["object", "array", "shallow-override"]).default("object")
}).passthrough();
const filterConfig = z.object({
  field: z.string().min(1),
  operator: z.enum(["equals", "not-equals", "contains", "greater-than", "less-than", "exists"]).default("exists"),
  value: z.unknown()
}).passthrough();
const ifConfig = z.object({
  field: z.string().min(1),
  operator: z.enum(["equals", "not-equals", "contains", "greater-than", "less-than", "truthy", "exists"]).default("truthy"),
  value: z.unknown()
}).passthrough();
const switchConfig = z.object({
  field: z.string().min(1),
  cases: z.array(z.object({ value: z.unknown(), handle: z.string().min(1) })).default([]),
  defaultHandle: z.string().default("default")
}).passthrough();
const delayConfig = z.object({
  milliseconds: z.number().int().min(0).max(60_000).default(1000)
}).passthrough();
const httpConfig = z.object({
  url: z.string().url(),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]).default("GET"),
  headers: z.record(z.string(), z.string()).default({}),
  body: z.unknown().optional(),
  timeoutMs: z.number().int().min(100).max(30_000).default(10_000)
}).passthrough();
const parseJsonConfig = z.object({
  source: z.enum(["input", "config"]).default("input"),
  value: z.string().optional()
}).passthrough();
const logConfig = z.object({
  level: z.enum(["debug", "info", "warn", "error"]).default("info"),
  message: z.string().default("Workflow log"),
  includeInput: z.boolean().default(true)
}).passthrough();

function compare(left: unknown, operator: string, right: unknown): boolean {
  switch (operator) {
    case "equals": return Object.is(left, right);
    case "not-equals": return !Object.is(left, right);
    case "contains":
      return typeof left === "string" ? left.includes(String(right))
        : Array.isArray(left) ? left.some((item) => Object.is(item, right))
        : false;
    case "greater-than": return typeof left === "number" && typeof right === "number" && left > right;
    case "less-than": return typeof left === "number" && typeof right === "number" && left < right;
    case "exists": return left !== undefined && left !== null;
    case "truthy": return Boolean(left);
    default: return false;
  }
}

function getPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current === null || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}

function isPublicHttpUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("HTTP node only supports http and https URLs");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const blocked = host === "localhost" || host.endsWith(".localhost") || host === "::1" ||
    host === "0.0.0.0" || host === "127.0.0.1" || host.startsWith("10.") ||
    host.startsWith("192.168.") || host.startsWith("169.254.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) || host === "metadata.google.internal";
  if (blocked) throw new Error("Requests to localhost, private, and link-local addresses are blocked");
  return url;
}

export function createHttpRequestNode(fetcher: typeof fetch = fetch): NodeDefinition {
  return defineNode({
    type: "http.request",
    name: "HTTP Request",
    category: "integration",
    description: "Make a bounded HTTP request to a public endpoint",
    inputs: [port("input", "Input", "any")],
    outputs: [port("status", "Status", "number"), port("headers", "Headers", "object"), port("data", "Response", "any")],
    configSchema: httpConfig,
    execute: async ({ config, context }) => {
      const url = isPublicHttpUrl(String(config.url));
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Number(config.timeoutMs));
      const abort = () => controller.abort();
      context.signal.addEventListener("abort", abort, { once: true });
      try {
        const response = await fetcher(url, {
          method: String(config.method),
          headers: config.headers as Record<string, string>,
          ...(config.body === undefined ? {} : { body: typeof config.body === "string" ? config.body : JSON.stringify(config.body) }),
          signal: controller.signal,
          redirect: "error"
        });
        const text = await response.text();
        let data: unknown = text;
        try { data = text.length ? JSON.parse(text) : null; } catch { /* preserve text */ }
        return {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          data
        };
      } finally {
        clearTimeout(timeout);
        context.signal.removeEventListener("abort", abort);
      }
    }
  });
}

export const builtInNodes: NodeDefinition[] = [
  defineNode({
    type: "trigger.manual", name: "Manual Trigger", category: "trigger",
    description: "Start a workflow with a manually supplied payload",
    inputs: [], outputs: [port("payload", "Payload", "any")],
    configSchema: manualConfig,
    execute: ({ input }) => ({ payload: input.input })
  }),
  defineNode({
    type: "trigger.webhook", name: "Webhook Trigger", category: "trigger",
    description: "Webhook entry point; the API adapter supplies the validated request payload",
    inputs: [], outputs: [port("payload", "Payload", "object"), port("headers", "Headers", "object"), port("query", "Query", "object")],
    configSchema: webhookConfig,
    execute: ({ input }) => {
      const request = input.input && typeof input.input === "object" ? input.input as Record<string, unknown> : {};
      return { payload: request.body ?? request, headers: request.headers ?? {}, query: request.query ?? {} };
    }
  }),
  defineNode({
    type: "trigger.schedule", name: "Schedule Trigger", category: "trigger",
    description: "Schedule metadata for a scheduler service to invoke",
    inputs: [], outputs: [port("payload", "Payload", "object")],
    configSchema: scheduleConfig,
    execute: ({ config, input }) => ({
      payload: {
        ...(input.input && typeof input.input === "object" ? input.input as Record<string, unknown> : {}),
        cron: config.cron,
        timezone: config.timezone
      }
    })
  }),
  defineNode({
    type: "data.set", name: "Set Values", category: "data",
    description: "Create or override fields in an object",
    inputs: [port("input", "Input", "any")], outputs: [port("value", "Value", "object")],
    configSchema: setConfig,
    execute: ({ input, config }) => ({
      value: { ...(input.input && typeof input.input === "object" && !Array.isArray(input.input) ? input.input as object : {}), ...(config.values as object) }
    })
  }),
  defineNode({
    type: "data.transform", name: "Transform", category: "data",
    description: "Map input object fields to new output names using dotted paths",
    inputs: [port("input", "Input", "any", true)], outputs: [port("value", "Value", "object")],
    configSchema: transformConfig,
    execute: ({ input, config }) => {
      const source = input.input;
      const result: Record<string, unknown> = {};
      for (const [key, path] of Object.entries(config.mappings as Record<string, string>)) result[key] = getPath(source, path);
      return { value: result };
    }
  }),
  defineNode({
    type: "data.merge", name: "Merge", category: "data",
    description: "Combine an object input, array input, or override fields",
    inputs: [port("input", "Input", "any"), port("left", "Left", "any"), port("right", "Right", "any")],
    outputs: [port("value", "Value", "any")],
    configSchema: mergeConfig,
    execute: ({ input, config }) => {
      const strategy = config.strategy;
      if (strategy === "array") return { value: [input.left, input.right].filter((value) => value !== undefined) };
      if (strategy === "shallow-override") return { value: { ...(input.left as object ?? {}), ...(input.right as object ?? {}) } };
      const base = input.input && typeof input.input === "object" && !Array.isArray(input.input) ? input.input as object : {};
      return { value: { ...base, ...(input.left as object ?? {}), ...(input.right as object ?? {}) } };
    }
  }),
  defineNode({
    type: "data.filter", name: "Filter", category: "data",
    description: "Filter an array by a field comparison",
    inputs: [port("items", "Items", "array", true)], outputs: [port("items", "Filtered items", "array"), port("count", "Count", "number")],
    configSchema: filterConfig,
    execute: ({ input, config }) => {
      if (!Array.isArray(input.items)) throw new Error("Filter input must be an array");
      const items = input.items.filter((item) => compare(getPath(item, String(config.field)), String(config.operator), config.value));
      return { items, count: items.length };
    }
  }),
  defineNode({
    type: "logic.if", name: "If / Else", category: "logic",
    description: "Route execution through true or false conditional output handles",
    inputs: [port("input", "Input", "any")],
    outputs: [port("true", "True", "boolean"), port("false", "False", "boolean"), port("condition", "Condition", "boolean")],
    configSchema: ifConfig,
    execute: ({ input, config }) => {
      const result = compare(getPath(input.input, String(config.field)), String(config.operator), config.value);
      return { true: result, false: !result, condition: result };
    }
  }),
  defineNode({
    type: "logic.switch", name: "Switch", category: "logic",
    description: "Route execution to the first matching case handle or default",
    inputs: [port("input", "Input", "any")],
    outputs: [port("default", "Default", "boolean")],
    configSchema: switchConfig,
    execute: ({ input, config }) => {
      const value = getPath(input.input, String(config.field));
      const cases = config.cases as { value: unknown; handle: string }[];
      const matched = cases.find((item) => Object.is(item.value, value));
      return { [matched?.handle ?? String(config.defaultHandle)]: true };
    }
  }),
  defineNode({
    type: "logic.delay", name: "Delay", category: "logic",
    description: "Wait for a bounded duration before passing input onward",
    inputs: [port("input", "Input", "any")], outputs: [port("value", "Value", "any")],
    configSchema: delayConfig,
    execute: async ({ input, config, context }) => {
      const duration = Number(config.milliseconds);
      await new Promise<void>((resolve, reject) => {
        if (context.signal.aborted) return reject(new Error("Execution cancelled"));
        const timer = setTimeout(resolve, duration);
        context.signal.addEventListener("abort", () => { clearTimeout(timer); reject(new Error("Execution cancelled")); }, { once: true });
      });
      return { value: input.input };
    }
  }),
  defineNode({
    type: "action.logger", name: "Logger", category: "action",
    description: "Write a structured execution log entry",
    inputs: [port("input", "Input", "any")], outputs: [port("value", "Value", "any")],
    configSchema: logConfig,
    execute: ({ input, config, context }) => {
      context.log(config.level as "debug" | "info" | "warn" | "error", String(config.message), config.includeInput ? { input: input.input } : {});
      return { value: input.input };
    }
  }),
  defineNode({
    type: "action.json.parse", name: "JSON Parser", category: "action",
    description: "Parse a JSON string into a structured value",
    inputs: [port("input", "JSON string", "string")], outputs: [port("value", "Parsed value", "any")],
    configSchema: parseJsonConfig,
    execute: ({ input, config }) => ({ value: JSON.parse(config.source === "config" ? String(config.value ?? "") : String(input.input ?? "")) as unknown })
  }),
  createHttpRequestNode()
];

export function createBuiltinNodeRegistry() {
  // Lazy import keeps the SDK package independent from a specific registry implementation.
  return builtInNodes;
}

export const builtInNodeTypes = builtInNodes.map((node) => node.type).sort();
