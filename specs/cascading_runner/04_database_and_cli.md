# Phase 4: Database & CLI Tools

**Goal:** Persist the classification decision and provide tools for users to debug their configuration.

**Status:** Not Started

## 1. Database Schema Updates

We need to store the `page_type` string (comma-separated if multiple) in the database so the Dashboard can filter by type later.

**File:** `packages/db/src/results.ts`

```sql
ALTER TABLE results ADD COLUMN page_types TEXT;
-- or JSON, but TEXT "global,product" is fine for now
```

**Changes:**

- Update `initializeSchema` to add the column (if using raw SQL).
- Update `saveAuditResult` function to accept `pageTypes: string[]`.

## 2. CLI `classify` Command

A new command to help users test their `awaconfig.json` without running a full potentially expensive scan.

**Usage:**
`awa classify --url https://example.com/some/page`

**Implementation:**
`packages/cli/src/commands/classify.ts`

```typescript
export async function classifyCommand(url: string, options: any) {
  const config = loadConfig(options.config);
  const classifier = new PageClassifier(config);

  // Launch headless specifically for this
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url);

  const types = await classifier.classify(url, page);

  console.log(`URL: ${url}`);
  console.log(`Detected Types: ${types.join(", ")}`);
  console.log(`Plugins that would run: ...`);

  await browser.close();
}
```

## 3. Redirect Handling

When a URL redirects (e.g., `product/abc` -> `product/abc/detail`), we must capture this to avoid confusion ("I scanned A but got results for B!").

**Schema Update:**

- Add `redirect_chain` (TEXT/JSON) to `results` table.
- Add `final_url` (TEXT) to `results` table.

**Logic:**

- **AuditWorker:** Captures the chain (`response.request().redirectedFrom()`).
- **Persist:** `saveAuditResult` records the _original_ requested URL (to match queue) but also the _final_ URL and chain.
- **Report:** Dashboard shows "Redirected via..." badge.

## Checkpoints

- [ ] Add `page_types` column to DB schema.
- [ ] Update `saveAuditResult` to persist types.
- [ ] Implement `awa classify` command in CLI.
- [ ] expose `classify` in `packages/cli/src/index.ts`.

## Confirmation Tests

Manual Verification:

1. Run `awa classify --url ...` on a known product page.
2. Verify output matches expected config.
