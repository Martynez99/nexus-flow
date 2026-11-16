import { z } from "zod";

export const portDataTypeSchema = z.enum([
  "string", "number", "boolean", "object", "array", "any"
]);

export const portSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  dataType: portDataTypeSchema.default("any"),
  required: z.boolean().default(false),
  description: z.string().optional()
});

export const nodeCategorySchema = z.enum([
  "trigger", "action", "logic", "data", "ai", "code", "integration"
]);

export const nodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  name: z.string().min(1),
  category: nodeCategorySchema,
  position: z.object({
    x: z.number().finite(),
    y: z.number().finite()
  }),
  inputs: z.array(portSchema).default([]),
  outputs: z.array(portSchema).default([]),
  config: z.record(z.string(), z.unknown()).default({})
});

export const edgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  sourceHandle: z.string().min(1),
  target: z.string().min(1),
  targetHandle: z.string().min(1),
  type: z.enum(["default", "conditional", "loop"]).default("default")
});

export const workflowSettingsSchema = z.object({
  timeoutMs: z.number().int().positive().max(86_400_000).default(300_000),
  retries: z.number().int().min(0).max(10).default(3),
  maxConcurrency: z.number().int().min(1).max(100).default(5)
});

export const workflowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(2_000).default(""),
  version: z.number().int().positive(),
  nodes: z.array(nodeSchema).min(1),
  edges: z.array(edgeSchema).default([]),
  settings: workflowSettingsSchema.default({})
});

export type PortDataType = z.infer<typeof portDataTypeSchema>;
export type WorkflowPort = z.infer<typeof portSchema>;
export type WorkflowNode = z.infer<typeof nodeSchema>;
export type WorkflowEdge = z.infer<typeof edgeSchema>;
export type WorkflowDefinition = z.infer<typeof workflowSchema>;
