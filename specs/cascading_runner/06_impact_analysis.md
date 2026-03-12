# Impact Analysis: Cascading Runner Refactor

This document outlines the specific files, data structures, and logic paths that will be modified during the refactor. It serves as a checklist to ensure no component is overlooked.

## 1. Data Structures & Configuration

**Status:** Major Breaking Changes.

- **File:** `packages/types/src/config.ts`
  - **Action:** Rewrite `ScannerConfig` interface and Zod schema.
  - **New Types:** `PageDefinition`, `PhaseConfig`.
  - **New Logic:** Add `definitions` (pattern matching) and `phases` (execution rules).

- **File:** `packages/types/src/index.ts`
  - **Action:** Export new types.

## 2. Core Logic

**Status:** High Impact. The linear "Discovery -> Audit" pipeline is being replaced by a multi-stage event loop.

### A. Worker Logic

- **File:** `packages/core/src/discovery-worker.ts`
  - **Change:** Will be significantly reduced.
  - **Logic:** Instead of crawling, it will focus on **Seeding** (Sitemap ingestion). Code for crawling (navigating to every link) will be moved to the Audit Worker as a side-effect.
  - **New Responsibility:** "Queue Seeder" (Ingest sitemap -> Normalize -> Push to Queue).

- **File:** `packages/core/src/audit-worker.ts`
  - **Change:** Major Refactor.
  - **Logic:**
    1.  **Classification:** Run `PageClassifier` on the loaded page.
    2.  **Dynamic Plugin Loading:** Select check groups based on Classification.
    3.  **Link Discovery:** (New) Extract links _during_ the audit pass to avoid a separate crawl.
    4.  **Observer Pattern:** Log "Link Issues" (e.g. non-canonical links) without re-queueing duplicates.

- **File:** `packages/core/src/classifier.ts` (New)
  - **Responsibility:** Matches current URL/DOM against `config.definitions`. Returns `PageType[]`.

- **File:** `packages/core/src/url-utils.ts` (New)
  - **Responsibility:** Centralized normalization (strip params, sort queries) used by both Seeder and Auditor.

### B. Pipeline & Orchestration

- **File:** `packages/core/src/pipeline.ts`
  - **Change:** Update `runPipeline` to accept a dynamic list of plugins per run, rather than a fixed list.

## 3. Database Schema

**Status:** Migration Required.

- **File:** `packages/db/src/schema.ts` (or equivalent initialization logic)
  - **Table `results`:** Add `page_types` (TEXT/JSON) to store classification.
  - **Table `queue`:** Add `normalized_url` (TEXT) to enforce uniqueness on content, not raw string.
  - **Table `link_observations`** (New?): To track "Page A links to Page B", allowing us to report on broken/redirecting links without auditing Page B.

- **File:** `packages/db/src/results.ts`
  - **Action:** Update `saveAuditResult` to persist `page_types`.

## 4. CLI & Entry Points

**Status:** Logic Update.

- **File:** `packages/cli/src/index.ts`
  - **Change:** Remove manual worker spawning if `Orchestrator` handles it.
  - **New Command:** `awa classify <url>` for debugging config.
  - **Startup:** Initialize `SitemapSeeder` if `discovery.mode !== 'crawl'`.

## 5. Cleanup Strategy

**Files to Remove/Deprecate:**

- **Legacy Crawl Logic:** If we move recursive crawling into `AuditWorker` side-effects, the standalone "Crawl Logic" in `discovery-worker` might be deleted. _Decision:_ Keep it for `discovery.mode = 'crawl'`, but refactor it to use `url-utils.ts`.

**Code to Removing:**

- Hardcoded `plugins` list in `AuditWorker` constructor.
- Duplicate URL normalization logic scattered in `discovery.ts`.

## 6. Risk Assessment

- **Data Loss:** We are switching how links are found. _Mitigation:_ The "Hybrid" mode in Phase 2.5 ensures we still have a safety net.
- **Performance:** Running `PageClassifier` (DOM IO) on every page might slow down the scan. _Mitigation:_ Ensure `PageClassifier` fails fast (check URL first, simple selectors second).
