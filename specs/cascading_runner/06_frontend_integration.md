# Phase 6: Frontend Dashboard Updates (Cascading Integration)

**Goal:** Clean up the existing specifications and define how the Dashboard exposes "Cascading Runner" features.

**Status:** Not Started

## 1. Exposing CLI Functionality

The Dashboard should act as a GUI wrapper around the CLI.

### A. "Classify URL" Tool

- **New Page/Component:** `src/pages/tools/classify.astro`
- **UI:** Simple input form for URL + "Test Classification" button.
- **Backend:** Calls `awa classify --url <url> --json` (or imports `PageClassifier` directly if running in same node process).
- **Display:** Shows JSON result of detected types + resolved plugins.

### B. "Redirect Chain" Visualization

- **Existing Page:** `src/pages/runs/[id].astro` (Run Details) or `src/pages/url/[id].astro` (Url Details).
- **UI:** If `redirect_url` is present in DB and differs from requested URL:
  - Show warning badge: "Redirected"
  - Show chain: `Requested: /foo` -> `Redirected To: /foo/`

### C. Filtering by Page Type

- **Existing Component:** `PageResultTable.tsx`
- **Logic:** Add dropdown filter for `Page Type` (e.g., "All", "Product", "Article").
- **Query:** `SELECT * FROM results WHERE page_types LIKE '%product%'`.

## 2. Updated Data Fetching

We need to update the Astro DB queries to fetch the new columns.

**File:** `apps/web/src/pages/runs/[id].astro`

```typescript
const pages = db
  .prepare(
    `
    SELECT
        q.url,
        q.status,
        q.depth,
        r.seo_score,
        r.page_types,     -- New Column
        r.redirect_url,   -- New Column
        COALESCE(SUM(a.count), 0) as violation_count
    FROM queue q
    LEFT JOIN results r ON q.url = r.url AND q.run_id = r.run_id
    LEFT JOIN a11y_findings a ON q.url = a.url AND q.run_id = a.run_id
    WHERE q.run_id = ?
    GROUP BY q.id
`,
  )
  .all(runId);
```

## 3. Configuration UI (Future)

Allow users to edit `awaconfig.json` via a form? (Out of scope for now, stick to `awa start` flags).

## Checklist

- [ ] Update `PageResultTable` to show "Type" column.
- [ ] Update `PageResultTable` to show Redirect info.
- [ ] Add "Classify" tool page.
