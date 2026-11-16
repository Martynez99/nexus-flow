# Architecture

## Current shape

NEXUS FLOW starts as a TypeScript monorepo with separately runnable web, API, and worker applications. Shared contracts live in packages so that the editor, API, and worker agree on workflow shapes.

## Trust boundaries

- The browser is untrusted input.
- The API validates all inbound workflow and credential operations.
- The worker processes validated execution requests but does not execute arbitrary user code in-process.
- JavaScript and Python code nodes will run in isolated runtimes with non-root identities, CPU/memory/time limits, filesystem restrictions, and explicit network policy.
- Secrets are encrypted at rest and redacted from logs and execution output.

## Execution invariants

- An execution references an immutable workflow version.
- Retries are bounded and use backoff.
- Cancellation is cooperative and propagated through an AbortSignal.
- External side effects should use idempotency keys where supported.
- Node outputs are validated before they are passed to downstream nodes.

## Planned implementation sequence

1. Monorepo and shared contracts.
2. Workflow schema and structural validation.
3. Deterministic in-process execution engine.
4. React Flow editor and API integration.
5. PostgreSQL persistence and immutable workflow versions.
6. Redis/BullMQ worker orchestration.
7. Connector SDK and initial integrations.
8. Sandboxed code execution and native AI orchestration.
