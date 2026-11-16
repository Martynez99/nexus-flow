# Built-in node catalog

The `@nexus-flow/builtin-nodes` package provides the first executable node catalog.

| Type | Node | Purpose |
|---|---|---|
| `trigger.manual` | Manual Trigger | Accept a manually supplied payload |
| `trigger.webhook` | Webhook Trigger | Adapt an authenticated API webhook request |
| `trigger.schedule` | Schedule Trigger | Carry cron/timezone metadata for the scheduler service |
| `data.set` | Set Values | Add or override object fields |
| `data.transform` | Transform | Map dotted input paths to output fields |
| `data.merge` | Merge | Merge objects or combine values into an array |
| `data.filter` | Filter | Filter arrays using comparisons |
| `logic.if` | If / Else | Emit true/false routing handles |
| `logic.switch` | Switch | Emit a selected case handle |
| `logic.delay` | Delay | Wait up to 60 seconds |
| `action.logger` | Logger | Emit structured execution logs |
| `action.json.parse` | JSON Parser | Parse JSON text |
| `http.request` | HTTP Request | Make bounded requests to public HTTP endpoints |

## Registering the catalog

```ts
import { NodeRegistry } from "@nexus-flow/workflow-engine";
import { builtInNodes } from "@nexus-flow/builtin-nodes";

const registry = new NodeRegistry();
for (const definition of builtInNodes) {
  registry.register(definition.type, definition.execute);
}
```

Custom nodes should use `defineNode` from `@nexus-flow/node-sdk`. Their configuration schemas are parsed before execution.

## Trigger adapters

Trigger nodes are entry-point adapters. The manual trigger receives the execution input directly. The webhook trigger expects the API layer to authenticate and authorize the webhook before passing its body, headers, and query values. The schedule trigger describes a cron expression and timezone; an external scheduler must create invocations. These nodes do not open network listeners or run background timers themselves.

## Conditional routing

If/Else emits boolean `true` and `false` output handles. Switch emits a boolean on the selected case handle. Connect those handles using conditional edges. The execution engine uses conditional edge values to decide which branch should run.

## HTTP security

HTTP Request supports bounded timeouts, disables redirects, and rejects obvious localhost/private/link-local destinations. This is a defense-in-depth baseline, not a complete SSRF boundary: production deployments must enforce outbound network policy in an isolated worker or egress proxy, including DNS resolution and rebinding protection. Do not put credentials in workflow config; use the encrypted secrets system when available.
