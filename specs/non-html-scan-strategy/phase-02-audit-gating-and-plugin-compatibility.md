# Phase 2 — Audit Gating & Plugin Compatibility (Living Spec)

Status: Complete  
Depends on: Phase 1

## Goal

Prevent incompatible plugin execution by enforcing resource-type-aware gating before classification and pipeline execution.

---

## Intended behavior

- `auditable_html` rows proceed through existing browser page audit flow.
- `inventory_only` rows skip audit pipeline and get deterministic skip status.
- `auditable_document` rows are deferred for Phase 4 unless explicitly enabled.

---

## Type changes (proposed)

### `packages/types/src/db.ts`

Add skip status:

```ts
export type QueueStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "stopped"
  | "skipped_non_html";
```

### `packages/types/src/audit.ts`

Introduce plugin capability metadata (backward compatible):

```ts
export type PluginTarget = "html" | "document" | "all";

export interface AuditPlugin {
  name: string;
  targets?: PluginTarget[]; // default ["html"] if omitted
  run(ctx: AuditContext, options?: Record<string, any>): Promise<void>;
}
```

---

## Runtime integration points

### `packages/core/src/audit-worker.ts`

Before creating `page`/running classifier:

1. read queue row metadata (`resource_type`, `audit_disposition`)
2. branch:
   - `inventory_only` → update status to `skipped_non_html`, optionally save minimal result meta
   - `auditable_document` and docs disabled → `skipped_non_html` with reason
   - `auditable_html` → existing flow

### `packages/core/src/plugin-resolver.ts`

- Filter plugin execution list by target compatibility.

Pseudo-filter:

```ts
const compatible = plugins.filter((p) => {
  const targets = p.targets ?? ["html"];
  return targets.includes(currentTarget) || targets.includes("all");
});
```

### `packages/core/src/pipeline.ts`

- No structural changes required; receives already compatible plugin list.

---

## Code sample — gating branch (proposed)

```ts
if (job.audit_disposition === "inventory_only") {
  updateJobStatus(db, job.id, "skipped_non_html");
  return;
}

if (job.audit_disposition === "auditable_document" && !config.auditDocuments) {
  updateJobStatus(db, job.id, "skipped_non_html");
  return;
}

// existing HTML flow continues
```

---

## Tests to add/update

Core worker tests:

- `packages/core/src/audit-worker.test.ts`
  - inventory-only URL gets `skipped_non_html`
  - html URL still executes plugin and saves results
  - document URL behavior follows config toggle

Resolver tests:

- `packages/core/src/plugin-resolver.test.ts`
  - plugin compatibility filters correctly

Commands:

- `vitest run packages/core/src/audit-worker.test.ts`
- `vitest run packages/core/src/plugin-resolver.test.ts`
- `npm run test:unit`

Acceptance checks:

- Non-HTML rows no longer inflate failure counts from incompatible audits.
- HTML plugin outputs unaffected for existing flows.

---

## Completion checklist

- [x] Queue status includes skip semantics
- [x] Audit worker gating branch implemented
- [x] Plugin compatibility filtering implemented
- [x] Worker and resolver tests green

---

## Living change log

### 2026-07-10

- Initial phase spec authored.

### 2026-07-11

- Added `skipped_non_html` queue status and plugin `targets` metadata.
- Implemented non-HTML gating in `packages/core/src/audit-worker.ts`.
- Implemented plugin target compatibility filtering in `packages/core/src/plugin-resolver.ts`.
- Added/updated tests in:
  - `packages/core/src/plugin-resolver.test.ts`
  - `packages/core/src/audit-worker.test.ts`
- Validated with targeted suite including Phase 1 and Phase 2 test files.
