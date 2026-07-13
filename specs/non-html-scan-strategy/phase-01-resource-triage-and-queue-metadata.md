# Phase 1 — Resource Triage & Queue Metadata (Living Spec)

Status: Complete  
Depends on: Phase 0

## Goal

Introduce first-class resource typing and disposition so discovery remains broad but semantics are explicit.

---

## Intended behavior

When a URL is discovered:

1. Normalize URL
2. Infer `resource_type` (extension-first, then optional content-type resolver)
3. Assign `audit_disposition`
4. Persist metadata with queue row

No plugin gating yet in this phase; this phase establishes data model foundations.

---

## Type changes (proposed)

### `packages/types/src/db.ts`

```ts
export type ResourceType = "html" | "document" | "media" | "binary" | "unknown";

export type AuditDisposition =
  | "auditable_html"
  | "auditable_document"
  | "inventory_only"
  | "deferred";

export interface QueueRow {
  id: number;
  run_id: string;
  url: string;
  status: QueueStatus;
  depth: number;
  priority: number;
  worker_id: string | null;
  resource_type?: ResourceType;
  audit_disposition?: AuditDisposition;
  skip_reason?: string | null;
  source?: "crawl" | "sitemap" | "manual";
  discovered_from?: string | null;
}
```

---

## DB/schema changes (proposed)

### `packages/db/src/connection.ts`

Add migrations for queue:

```sql
ALTER TABLE queue ADD COLUMN resource_type TEXT DEFAULT 'unknown';
ALTER TABLE queue ADD COLUMN audit_disposition TEXT DEFAULT 'deferred';
ALTER TABLE queue ADD COLUMN skip_reason TEXT DEFAULT NULL;
ALTER TABLE queue ADD COLUMN source TEXT DEFAULT NULL;
ALTER TABLE queue ADD COLUMN discovered_from TEXT DEFAULT NULL;
```

Note: Existing SQLite constraints are permissive; enforce value sets at application/type layer initially.

---

## Runtime integration points

### `packages/core/src/discovery.ts`

- Add helper (new file suggested): `packages/core/src/resource-triage.ts`
- Use triage result during `filterLinks` pipeline (or adjacent function) without yet changing audit execution behavior.

### `packages/core/src/audit-worker.ts`

- Immediate extraction should include source metadata for inserted rows (`source='crawl'`, `discovered_from=job.url`).

### `packages/core/src/sitemap.ts` + `packages/cli/src/index.ts`

- Sitemap ingestion path should mark `source='sitemap'` and pre-classify discovered URLs.

### `packages/db/src/queue.ts`

- Extend `insertJob` signature to accept optional metadata payload.

Proposed API shape:

```ts
insertJob(db, {
  run_id,
  url,
  depth,
  priority,
  resource_type,
  audit_disposition,
  skip_reason,
  source,
  discovered_from,
});
```

---

## Code sample — triage helper (proposed)

```ts
const DOCUMENT_EXT = new Set(["pdf", "doc", "docx", "ppt", "pptx"]);
const MEDIA_EXT = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "mp4",
  "webm",
]);

export function inferResourceType(url: string): ResourceType {
  const pathname = new URL(url).pathname.toLowerCase();
  const ext = pathname.includes(".") ? (pathname.split(".").pop() ?? "") : "";
  if (!ext) return "unknown";
  if (ext === "html" || ext === "htm") return "html";
  if (DOCUMENT_EXT.has(ext)) return "document";
  if (MEDIA_EXT.has(ext)) return "media";
  return "binary";
}

export function assignDisposition(
  resourceType: ResourceType,
): AuditDisposition {
  if (resourceType === "html" || resourceType === "unknown")
    return "auditable_html";
  if (resourceType === "document") return "auditable_document";
  return "inventory_only";
}
```

---

## Tests to add/update

Unit:

- `packages/core/src/discovery.test.ts`
  - add cases for extension triage and disposition assignment
- add new test file:
  - `packages/core/src/resource-triage.test.ts`

DB:

- `packages/db/src/queue.test.ts`
  - insert/read metadata columns
  - defaults for legacy inserts

Commands:

- `vitest run packages/core/src/discovery.test.ts`
- `vitest run packages/db/src/queue.test.ts`
- `npm run test`

Acceptance checks:

- Queue rows contain `resource_type` and `audit_disposition` for new scans.
- No regression in run start/completion behavior.

---

## Completion checklist

- [x] Types extended in `types`
- [x] DB migrations added and idempotent
- [x] `insertJob` metadata support merged
- [x] Discovery/sitemap sources annotated
- [x] Unit+DB tests green

---

## Living change log

### 2026-07-10

- Initial phase spec authored.

### 2026-07-11

- Implemented `resource_type`/`audit_disposition` metadata model in queue types and schema.
- Added `packages/core/src/resource-triage.ts` and related tests.
- Updated queue insertion to persist metadata and infer defaults for backward-compatible callers.
- Wired metadata insertion from CLI seeds/sitemap and worker-discovered URLs.
- Validated with targeted tests:
  - `packages/core/src/resource-triage.test.ts`
  - `packages/db/src/queue.test.ts`
  - `packages/core/src/discovery.test.ts`
