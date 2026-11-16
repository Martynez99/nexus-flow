# NEXUS FLOW

**Open-source, self-hosted, AI-native workflow automation.**

NEXUS FLOW is a modular automation platform being built to connect apps, APIs, data, and AI agents through visual, versioned workflows. Its goal is to give teams a self-hostable alternative to closed automation platforms, with an extensible connector SDK and secure execution architecture.

> **Project status: early development.** The repository includes the monorepo foundation, a workflow schema and validator, an in-process execution engine, a node SDK, and an initial built-in node catalog. The visual editor, persistent/distributed execution, authentication, production-grade connector infrastructure, and isolated code execution are still under development.

## What NEXUS FLOW is designed to provide

- **Visual workflow builder** — drag-and-drop nodes, typed ports, branching, and workflow inspection.
- **App and API integrations** — an extensible TypeScript connector SDK and a growing community catalog.
- **AI-native automation** — agent workflows, model and tool calls, retrieval, memory, and human approval steps.
- **Reliable execution** — versioned workflows, retries, idempotency, cancellation, checkpoints, and execution history.
- **Self-hosting** — deployable on your own infrastructure, with control over data and credentials.
- **Security-first execution** — tenant boundaries, encrypted secrets, least privilege, and isolated runtimes for user code.

## Current implementation

| Component | Status |
|---|---|
| pnpm/Turborepo monorepo | Scaffolded |
| Fastify API health endpoint | Implemented |
| Background worker | Scaffold only; queue consumer not implemented |
| Shared execution types | Implemented |
| Workflow schema (Zod) | Initial implementation |
| Structural workflow validation | Initial implementation |
| Workflow execution engine | Initial in-process engine implemented; durable/distributed execution planned |
| Node SDK | Initial implementation |
| Built-in node catalog | Initial triggers, data, logic, actions and HTTP nodes |
| React visual editor | Planned |
| PostgreSQL/Prisma persistence | Planned |
| Redis/BullMQ queue | Planned |
| Connector SDK and catalog | Planned |
| AI orchestration | Planned |
| Sandboxed code execution | Planned |

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
  worker/              Background execution worker
packages/
  shared/              Shared types and utilities
  workflow-schema/     Versioned workflow contracts and validation
  workflow-engine/     Deterministic in-process workflow execution core
  node-sdk/             Typed custom-node authoring SDK
  builtin-nodes/        Trigger, data, logic, action and HTTP nodes
  integration-sdk/      Planned connector authoring contracts
docs/                  Architecture, execution and node catalog documentation
.github/workflows/     Continuous integration
```

## Requirements

- Node.js 22 LTS
- pnpm 10

Docker Engine and Docker Compose will be required as infrastructure services are added.

## Getting started

```bash
corepack enable
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

To start the API health endpoint:

```bash
pnpm --filter @nexus-flow/api dev
```

Then open `http://localhost:3001/health`.

The worker is currently a scaffold and does not yet consume jobs.

## Development principles

1. Validate workflow definitions at every trust boundary.
2. Execute user-authored code outside the API process, in isolated non-root runtimes with resource limits.
3. Treat credentials and execution payloads as sensitive; never log secrets.
4. Persist immutable workflow versions and bind every execution to an exact version.
5. Make retries and external side effects idempotent wherever possible.
6. Keep connectors modular, typed, documented, and independently testable.

## Contributing

Contributions are welcome. Please open an issue to discuss substantial changes before submitting a pull request. Run the type checks, tests, and build locally before opening a PR.

## License

NEXUS FLOW is released under **GNU Affero General Public License v3.0 only (AGPL-3.0-only)**. See [LICENSE](./LICENSE).
