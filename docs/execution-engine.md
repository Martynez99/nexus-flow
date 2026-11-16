# Workflow execution engine

The initial engine is an in-process deterministic graph executor. It is deliberately separate from HTTP handlers, persistence, queues, and untrusted-code runtimes.

## Execution model

1. Validate the workflow structure with `@nexus-flow/workflow-schema`.
2. Build a topological execution plan. Nodes in the same layer have no dependency on one another and may run concurrently up to the configured limit.
3. Resolve each node's input handles from the output handles of its incoming edges.
4. Resolve the node executor from a `NodeRegistry`.
5. Record per-node timestamps, outputs, and errors in the returned execution result.

## Minimal example

```ts
import { WorkflowEngine, NodeRegistry } from "@nexus-flow/workflow-engine";

const registry = new NodeRegistry()
  .register("manual.trigger", ({ input }) => ({ payload: input.input }))
  .register("text.upper", ({ input }) => ({
    result: String(input.value).toUpperCase()
  }));

const engine = new WorkflowEngine(registry);
const result = await engine.execute({
  workflow,
  executionId: crypto.randomUUID(),
  input: "hello"
});
```

A trigger executor receives the caller-provided value as `input.input`. Connected downstream nodes receive values keyed by their target input-handle IDs.

## Current limitations

- Conditional and loop edges are rejected explicitly; they are not silently treated as ordinary edges.
- Multiple incoming edges to the same input handle are rejected at runtime.
- A failed node fails the execution; downstream layers do not run. Other nodes already running in the same concurrency batch are awaited.
- Cancellation uses `AbortSignal`. Executors must honor the supplied signal to stop their own in-flight work.
- Retry settings are schema metadata only. Retry policies, durable checkpoints, persistence, distributed workers, and timeouts are future milestones.
- This engine does not execute user-authored JavaScript or Python. Such code must run in a separate hardened sandbox service.

The engine is a prototype runtime, not yet a durable production orchestrator.
