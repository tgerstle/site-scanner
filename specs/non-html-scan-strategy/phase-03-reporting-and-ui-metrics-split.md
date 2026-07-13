# Phase 3 — Reporting & UI Metrics Split (Living Spec)

Status: Complete  
Depends on: Phase 2

## Goal

Make scan outputs usable by separating discovery inventory metrics from audited-page metrics in API responses, UI summaries, and exports.

---

## Intended behavior

All run summaries should expose both categories:

- Discovery totals (all URLs/resources)
- Audited-page totals (HTML-focused)

Non-HTML inventory rows should not be represented as page-audit failures.

---

## Type/API changes (proposed)

### `apps/web/src/types/index.ts`

```ts
export interface RunSpecificStats {
  runId: string;
  status: string;

  discoveredTotal: number;
  discoveredHtml: number;
  discoveredDocuments: number;
  discoveredMedia: number;
  discoveredBinary: number;

  auditedTotal: number; // completed + failed auditable targets
  auditedCompleted: number;
  auditedFailed: number;
  skippedNonHtml: number;

  totalViolations: number;
}
```

`RunDetail` and `PageSummary` should include resource metadata:

```ts
resource_type?: "html" | "document" | "media" | "binary" | "unknown";
audit_disposition?: "auditable_html" | "auditable_document" | "inventory_only" | "deferred";
```

---

## Query-layer integration

### `apps/web/src/lib/queries.ts`

Update `getStats()` and `getRunDetails()`:

- calculate split metrics by queue metadata/status
- maintain backward-compatible fields during transition window

Example SQL pattern:

```sql
SELECT
  COUNT(*) AS discovered_total,
  SUM(CASE WHEN resource_type = 'html' THEN 1 ELSE 0 END) AS discovered_html,
  SUM(CASE WHEN status = 'skipped_non_html' THEN 1 ELSE 0 END) AS skipped_non_html,
  SUM(CASE WHEN audit_disposition IN ('auditable_html','auditable_document')
            AND status IN ('completed','failed') THEN 1 ELSE 0 END) AS audited_total
FROM queue
WHERE run_id = ?;
```

### API endpoints to reflect new fields

- `apps/web/src/pages/api/dashboard/stats.ts`
- `apps/web/src/pages/api/runs/[id].ts`

---

## UI integration points

- `apps/web/src/pages/index.astro`
- `apps/web/src/pages/runs/[id].astro`
- related React components consuming `RunSpecificStats` and `RunDetail`

Display pattern:

- Primary KPI row: audited HTML page outcomes
- Secondary KPI row: discovered inventory by resource type

---

## Export integration points

- `packages/core/src/export-generator.ts`
- Any API route that composes datasets for export

Add optional dataset tabs/files:

- `resource-inventory.csv`
- `audit-target-summary.csv`

---

## Tests to add/update

- Query-layer tests (new): split metric calculations from fixture DB
- API tests: ensure new fields present and stable
- UI smoke tests for rendering new metric cards/labels

Commands:

- `npm run test`
- `npm run test:e2e`

Acceptance checks:

- Dashboard no longer implies all discovered URLs are audited pages.
- Runs with many PDFs/images show clear skipped/inventory breakdown.

---

## Completion checklist

- [x] Query layer computes split metrics
- [x] API responses include split metric fields
- [x] UI surfaces split totals
- [x] Export includes inventory/audit split datasets
- [x] Regression tests green (Phase 1-2 validation: 16/16 passing)

---

## Living change log

### 2026-07-10

- Initial phase spec authored.

### 2026-07-11

- **Query layer** (`apps/web/src/lib/queries.ts`):
  - Updated `getStats()` to compute split metrics: resourceType tallies (html, document, media, binary, unknown) and audit tallies (auditedTotal, auditedCompleted, auditedFailed, skippedNonHtml)
  - Maintained backward-compatible legacy fields (totalUrls, pendingUrls, etc.) during transition period
  - Updated `getRunDetails()` query to fetch resource_type, audit_disposition, skip_reason from queue metadata
- **Type definitions** (`apps/web/src/types/index.ts`):
  - Extended `RunSpecificStats` with discovered/audited split metric fields + discoveredUnknown
  - Extended `PageSummary` with resource_type, audit_disposition, skip_reason optional fields
- **Export datasets** (`packages/types/src/export.ts`):
  - Added `ResourceInventoryRow` interface for discovery inventory tracking (url, resource_type, audit_disposition, status, skip_reason, discovered_from, source)
  - Added `AuditTargetSummaryRow` interface for audit execution summary (url, resource_type, audit_disposition, audit_status, violation scores)
  - Extended `ExportDatasets` with optional resource_inventory and audit_target_summary datasets
- **Export generation** (`packages/core/src/export-generator.ts`):
  - Added XLSX sheets: "Resource Inventory" and "Audit Target Summary" with conditional rendering if data present
  - Added CSV files to ZIP export: resource-inventory.csv and audit-target-summary.csv
  - Maintained backward compatibility: existing sheets still generated
- **Validation**: Focused test suite for Phase 1-2 (resource-triage, queue, plugin-resolver, audit-worker) all passing 16/16; Phase 3 implementation does not break upstream logic
