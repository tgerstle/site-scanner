# Non-HTML Strategy Implementation Overview (Living Spec)

Status: Draft  
Owner: Scanner team  
Last Updated: 2026-07-11

## Purpose

Define a phased implementation plan for introducing a two-track scan model:

- Track A: broad URL/resource discovery inventory
- Track B: targeted audit execution for auditable resources

This document is the control-plane spec and links to detailed phase specs.

---

## Why this change

Current architecture queues discovered URLs and treats queue totals as page totals, which makes non-HTML URLs (PDF/image/media) degrade usability of run metrics.

Observed integration points:

- Discovery filtering is domain/path oriented and does not classify file/content type.
- Audit worker performs immediate extraction and enqueues discovered URLs.
- Queue rows are used as “pages” in dashboard and run detail rollups.

---

## Architecture target

### Existing high-level flow

1. discover links
2. filter by domain/path
3. enqueue in `queue`
4. audit worker runs plugins
5. UI reports queue counts as page totals

### Target high-level flow

1. discover links/resources
2. triage/classify resource type and disposition
3. write inventory record
4. if auditable, enqueue/run compatible audits
5. report inventory and audit metrics separately

---

## Phase map

- Phase 0: Baseline & instrumentation
- Phase 1: Resource triage + queue metadata
- Phase 2: Audit gating + plugin compatibility model
- Phase 3: Reporting/UI split metrics + exports
- Phase 4: Optional document audit lane
- Phase 5: Hardening, migration, and operational safeguards

Detailed specs:

- [Phase 0](phase-00-baseline-and-instrumentation.md)
- [Phase 1](phase-01-resource-triage-and-queue-metadata.md)
- [Phase 2](phase-02-audit-gating-and-plugin-compatibility.md)
- [Phase 3](phase-03-reporting-and-ui-metrics-split.md)
- [Phase 4](phase-04-document-audit-lane.md)
- [Phase 5](phase-05-hardening-migration-and-ops.md)

---

## Current codebase integration map

Core runtime:

- `packages/core/src/discovery.ts`
- `packages/core/src/audit-worker.ts`
- `packages/core/src/discovery-worker.ts`
- `packages/core/src/sitemap.ts`
- `packages/core/src/pipeline.ts`
- `packages/core/src/plugin-resolver.ts`
- `packages/core/src/classifier.ts`

Config/types:

- `packages/types/src/cascading/config.ts`
- `packages/types/src/db.ts`
- `packages/types/src/audit.ts`

Persistence:

- `packages/db/src/connection.ts`
- `packages/db/src/queue.ts`
- `packages/db/src/results.ts`

CLI flow:

- `packages/cli/src/index.ts`

Web/API/queries:

- `apps/web/src/lib/queries.ts`
- `apps/web/src/pages/api/dashboard/stats.ts`
- `apps/web/src/pages/api/runs/[id].ts`
- `apps/web/src/pages/runs/[id].astro`

Tests to evolve:

- `packages/core/src/discovery.test.ts`
- `packages/core/src/audit-worker.test.ts`
- `packages/core/src/plugin-resolver.test.ts`
- `packages/db/src/queue.test.ts`
- integration tests under `tests/integration/`

---

## Living status tracker

| Phase | Name                                 | Status   | Notes                                                               |
| ----- | ------------------------------------ | -------- | ------------------------------------------------------------------- |
| 0     | Baseline & instrumentation           | Planned  | Establish measurable baseline before behavior changes               |
| 1     | Resource triage + queue metadata     | Complete | Implemented in types/db/core/cli with targeted tests passing        |
| 2     | Audit gating + plugin compatibility  | Complete | Implemented gating + plugin target compatibility with tests passing |
| 3     | Reporting/UI split metrics + exports | Complete | Query/API/export layer split metrics implemented with types updated |
| 4     | Optional document audit lane         | Complete | Document context, config, worker branch, and plugin filtering added |
| 5     | Hardening/migration/ops              | Planned  | Backfill, rollout flags, operational controls                       |

Update rule for this table:

- `Planned` → `In Progress` when coding starts
- `In Progress` → `Complete` after acceptance tests pass
- Add “Change log” entry whenever scope adjusts

---

## Cross-phase type model (target)

```ts
// Conceptual model (final shape may evolve by phase)
export type ResourceType = "html" | "document" | "media" | "binary" | "unknown";

export type AuditDisposition =
  | "auditable_html"
  | "auditable_document"
  | "inventory_only"
  | "deferred";

export type QueueStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "stopped"
  | "skipped_non_html";
```

---

## Cross-phase config model (target)

```ts
// Conceptual final config additions
interface NonHtmlPolicyConfig {
  auditHtmlOnly?: boolean; // default true
  auditDocuments?: boolean; // default false
  blockedExtensions?: string[]; // default curated set
  allowedContentTypes?: string[]; // defaults include text/html
  countMode?: "audited-only" | "all-discovered" | "both";
}
```

---

## Cross-phase acceptance criteria

1. Non-HTML resources are discoverable and traceable.
2. HTML page KPIs are not distorted by non-HTML URLs.
3. Non-HTML default outcomes are skip/disposition, not generic failures.
4. Plugin execution is resource-compatible by design.
5. Existing HTML-focused workflows remain backward-compatible by default.

---

## Test strategy (global)

Execution layering:

1. Unit tests for triage, resolution, and status transitions
2. DB tests for schema/migrations and query behavior
3. Worker tests for gating behavior and result persistence
4. API/query tests for new summary fields
5. Integration/e2e tests for end-to-end counts and statuses

Base commands:

- `npm run test`
- `npm run test:unit`
- `npm run test:e2e`

Targeted runs (examples to add in phase docs):

- `vitest run packages/core/src/discovery.test.ts`
- `vitest run packages/core/src/audit-worker.test.ts`
- `vitest run packages/db/src/queue.test.ts`

---

## Change log

### 2026-07-10

- Created implementation overview and phased doc structure.
- Completed architecture integration reconnaissance across core/db/types/cli/web.
- Identified primary coupling points where URL counts are interpreted as page counts.

### 2026-07-11

- Phase 1 completed: resource triage helper, queue metadata types/schema, insert plumbing, ingestion wiring, and tests.
- Phase 2 completed: non-HTML audit gating, plugin target compatibility, and updated tests.
- Phase 3 completed: Query-layer split metrics (getStats, getRunDetails), type definitions extended (RunSpecificStats, PageSummary with resource metadata), export datasets (ResourceInventoryRow, AuditTargetSummaryRow), and export generation updated with XLSX/CSV support. Phase 1-2 validation suite (16/16 tests) remains green post-Phase-3 implementation.
- Phase 4 completed: Document audit lane with config support (nonHtmlPolicy), DocumentAuditContext type, worker document branch (processJob pre-check), and plugin resolver for document-compatible plugins. Full test coverage (audit-worker + plugin-resolver) with Phase 1-3 validation: 21/21 tests passing.
