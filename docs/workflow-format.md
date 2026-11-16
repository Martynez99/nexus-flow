# Workflow format

A workflow is a versioned directed graph. Nodes declare typed input and output ports; edges connect one output handle to one input handle.

## Invariants

- Node and edge IDs must be unique within a workflow.
- Every edge must reference existing source and target nodes.
- Every edge handle must reference a declared output/input port.
- Port types must match, unless either side declares `any`.
- Workflow versions are positive integers. Published versions should be immutable.

## Example

See the `validWorkflow` fixture in `packages/workflow-schema/src/validate.test.ts`.

The schema is a structural contract, not a security boundary. Runtime execution must still validate payloads, enforce authorization, and isolate untrusted code.
