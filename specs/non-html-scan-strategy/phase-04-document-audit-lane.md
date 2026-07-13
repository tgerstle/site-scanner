# Phase 4 — Document Audit Lane (Optional) (Living Spec)

Status: Complete  
Depends on: Phase 3

## Goal

Introduce an opt-in document audit path (initially PDF-focused) that is separate from HTML DOM/plugin execution.

---

## Intended behavior

- If `auditDocuments=false` (default): documents remain inventory or skipped.
- If `auditDocuments=true`: documents run through document-compatible plugins only.

No HTML-only plugin should run on raw document resources.

---

## Config changes (proposed)

### `packages/types/src/cascading/config.ts`

```ts
nonHtmlPolicy: z.object({
  auditHtmlOnly: z.boolean().default(true),
  auditDocuments: z.boolean().default(false),
  documentContentTypes: z.array(z.string()).default(["application/pdf"]),
  blockedExtensions: z.array(z.string()).optional(),
}).optional();
```

---

## Plugin model extensions

### `packages/types/src/audit.ts`

Add optional document context support while preserving current HTML context:

```ts
export interface DocumentAuditContext {
  run_id: string;
  url: string;
  contentType?: string;
  bytes?: Buffer;
  results: Partial<AuditResults>;
  log: (msg: string) => void;
  flags: { hasErrors: boolean };
}

export interface AuditPlugin {
  name: string;
  targets?: ("html" | "document" | "all")[];
  run(
    ctx: AuditContext | DocumentAuditContext,
    options?: Record<string, any>,
  ): Promise<void>;
}
```

---

## Runtime integration points

- `packages/core/src/audit-worker.ts`
  - add document branch execution path
- `packages/core/src/plugin-loader.ts`
  - no major change expected unless plugin packaging differs
- `packages/core/src/plugin-resolver.ts`
  - resolve document-compatible plugins for document targets
- new plugin folder candidate:
  - `packages/plugins/` document plugin module(s)

---

## Code sample — document lane branch (proposed)

```ts
if (job.audit_disposition === "auditable_document") {
  if (!config.nonHtmlPolicy?.auditDocuments) {
    updateJobStatus(db, job.id, "skipped_non_html");
    return;
  }

  const docPlugins = resolveDocumentPlugins(...);
  const docCtx: DocumentAuditContext = {
    run_id: job.run_id,
    url: job.url,
    results: {},
    log,
    flags: { hasErrors: false },
  };

  await runPipeline(docCtx as any, docPlugins);
  saveAuditResult(db, { run_id: job.run_id, url: job.url, results: docCtx.results });
  updateJobStatus(db, job.id, "completed");
  return;
}
```

---

## Tests to add/update

- Worker tests for document-on and document-off modes
- Plugin resolver tests for document target matching
- Integration test with sample PDF URL fixture (mocked)

Commands:

- `vitest run packages/core/src/audit-worker.test.ts`
- `vitest run packages/core/src/plugin-resolver.test.ts`
- `npm run test:e2e`

Acceptance checks:

- Document-only runs do not execute HTML-only plugins.
- Document lane writes predictable, typed results.

---

## Completion checklist

- [x] Config supports document audit toggle
- [x] Document plugin target model in place
- [x] Worker supports document execution branch
- [x] Document lane tests green (Phase 1-3 validation: 21/21 passing)

---

## Living change log

### 2026-07-10

- Initial phase spec authored.

### 2026-07-11

- **Config schema** (`packages/types/src/cascading/config.ts`):
  - Added `NonHtmlPolicySchema` and `NonHtmlPolicy` type with auditHtmlOnly, auditDocuments, documentContentTypes fields
  - Extended ScannerConfig to include optional nonHtmlPolicy field
- **Document audit context** (`packages/types/src/audit.ts`):
  - Added `DocumentAuditContext` interface with run_id, url, contentType, results, log, flags (no browser page)
  - Updated `AuditPlugin.run()` signature to accept `AuditContext | DocumentAuditContext`
- **Plugin resolution** (`packages/core/src/plugin-resolver.ts`):
  - Added `resolveDocumentPlugins()` helper to filter global-phase plugins by document target compatibility
  - Document plugins must explicitly target "document" or "all" to be included
- **Worker document branch** (`packages/core/src/audit-worker.ts`):
  - Added imports for DocumentAuditContext and resolveDocumentPlugins
  - Added document branch in processJob() before HTML branch:
    - Checks `audit_disposition === "auditable_document"`
    - Verifies `config.nonHtmlPolicy?.auditDocuments` is enabled
    - Resolves document-compatible plugins
    - Executes pipeline with DocumentAuditContext (no page, contentType populated)
    - Saves results and marks job completed
- **Tests**:
  - audit-worker.test.ts: Added 2 tests (runs document audit when enabled, skips when disabled)
  - plugin-resolver.test.ts: Added 3 tests for resolveDocumentPlugins (compatible plugins, missing warnings, legacy fallback)
- **Validation**: Phase 1-3 + Phase 4 focused tests all passing 21/21; no regressions
