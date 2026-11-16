# NEXUS FLOW

**Open-source, self-hosted, AI-native workflow automation.**

NEXUS FLOW is being built as a modular automation platform with a visual workflow editor, durable execution, an extensible connector SDK, and native AI-agent orchestration.

> **Development status:** early foundation. The repository currently contains the monorepo scaffold. Backend execution, persistence, authentication, connector implementations, and sandboxed code execution are not yet production-ready.

## Product direction

- Visual, drag-and-drop workflow editor built with React Flow.
- TypeScript-first workflow definitions and connector SDK.
- Fastify API with PostgreSQL/Prisma persistence.
- Redis and BullMQ for background execution.
- Separate workers for workflow execution and untrusted code.
- AI agents, tools, memory, retrieval, and human approval steps.
- Self-hosted deployment with Docker Compose.
- Reliability primitives: immutable workflow versions, retries, idempotency, cancellation, checkpoints, and execution history.
- Security-first design: tenant isolation, encrypted credentials, least privilege, and isolated code runtimes.

## Planned architecture

| Area | Initial technology |
|---|---|
| Web application | React, TypeScript, Vite, Tailwind CSS, React Flow |
| API | Node.js, Fastify, Zod |
| Data | PostgreSQL, Prisma |
| Queue | Redis, BullMQ |
| AI orchestration | LangGraph.js |
| Code editor | Monaco Editor |
| Monorepo | pnpm workspaces, Turborepo |
| Tests | Vitest |
| Observability | OpenTelemetry |

The initial architecture is a modular monolith with independently deployed execution workers. Services will be split further only when operational evidence justifies it.

## Repository layout

```text
apps/
  api/                 Fastify HTTP API
  web/                 React workflow editor
  worker/              Background execution worker
packages/
  shared/              Shared types and utilities
  workflow-schema/     Versioned workflow contracts and validation
  workflow-engine/     Deterministic workflow execution core
  integration-sdk/     Connector authoring contracts
infrastructure/        Local development and deployment assets
docs/                  Architecture and contributor documentation
```

## Requirements

- Node.js 22 LTS
- pnpm 10
- Docker Engine and Docker Compose (for infrastructure services)

## Getting started

```bash
corepack enable
pnpm install
pnpm dev
```

The initial scaffold is intentionally minimal; application packages will gain runnable scripts as their first implementation milestones land.

## Development principles

1. Validate workflow definitions at every trust boundary.
2. Execute user-authored code outside the API process, in isolated non-root runtimes with resource limits.
3. Treat credentials and execution payloads as sensitive; never log secrets.
4. Persist immutable workflow versions and bind every execution to an exact version.
5. Make retries and external side effects idempotent wherever possible.
6. Keep connectors modular, typed, documented, and independently testable.

## License

NEXUS FLOW is intended to be released under **GNU Affero General Public License v3.0 only (AGPL-3.0-only)**. See [LICENSE](./LICENSE).
