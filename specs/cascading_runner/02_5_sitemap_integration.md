# Phase 2.5: Discovery & Sitemap Integration

**Goal:** Enhance the Discovery phase to prioritize sitemaps as the "Source of Truth" while retaining the ability to crawl for orphaned pages.

**Status:** Not Started

## 1. The Strategy: "Hybrid Discovery"

We want to support three modes of discovery:

1.  **Crawl Only:** Start at Home, follow links (Current behavior).
2.  **Sitemap Only:** Read `sitemap.xml`, audit those URLs, stop.
3.  **Hybrid (Robust):**
    - **Step 1:** Ingest all URLs from `sitemap.xml` as a baseline.
    - **Step 2:** Start crawling from Home.
    - **Step 3:** Use the crawl to find _orphaned_ pages (pages linked on the site but missing from the sitemap).
    - **Step 4:** Report on "Sitemap Gaps" (urls existing but not in sitemap).

## 2. Sitemap Parser Implementation

We need a robust parser that handles:

- Standard `sitemap.xml`.
- Sitemap Indexes (nested sitemaps).
- Correctly handling `robots.txt` to find the sitemap location.

**File:** `packages/core/src/sitemap.ts`

```typescript
import { parseStringPromise } from "xml2js"; // or similar

export async function fetchSitemap(url: string): Promise<string[]> {
  // 1. Try /sitemap.xml if not provided
  // 2. Fetch content
  // 3. Detect if Index or UrlSet
  // 4. Recursively fetch if Index
  // 5. Return flat array of unique URLs
}
```

## 3. URL Normalization Utility

To prevent duplicates (e.g., `?ref=twitter` vs `?ref=facebook`), we need a central normalizer used by both Sitemap ingestion and Crawl.

**File:** `packages/core/src/url-utils.ts`

```typescript
export function normalizeUrl(
  url: string,
  options: {
    stripQueryParams: string[]; // e.g. ["utm_*", "ref"]
    sortQueryParams: boolean; // true
  },
): string {
  // 1. Parse URL
  // 2. Remove specified params
  // 3. Sort remaining params
  // 4. Standardize trailing slash (e.g., typically remove unless root)
  // 5. Lowercase hostname
  // 6. Return clean string
}
```

This ensures that if the Sitemap has `example.com/page` and a link has `example.com/page?utm_source=x`, they resolve to the same Queue Item.

## 4. Configuration Updates

Update `packages/types/src/config.ts` to control this behavior.

```typescript
export interface WrapperConfig {
  // ...
  discovery: {
    /**
     * "crawl" = Follow links (default)
     * "sitemap" = Use sitemap only
     * "hybrid" = Use sitemap + crawl
     */
    mode: "crawl" | "sitemap" | "hybrid";

    /**
     * Explicit path to sitemap. If not provided, we try standard locations.
     */
    sitemapUrl?: string;
  };
}
```

## 4. Queue Management for Hybrid Mode

The challenge with Hybrid mode is **Duplicates**. The sitemap might yield 10,000 URLs, and the crawl will find the same 10,000.

**Solution:** `INSERT IGNORE` (or `ON CONFLICT DO NOTHING`) in SQLite.

- **Step A:** Fetch Sitemap -> specific `INSERT` batch.
- **Step B:** Start Discovery Worker.
- **Step C:** When Discovery Worker finds a link, it tries to `INSERT`.
  - If URL exists (from Sitemap), it is ignored (good!).
  - If URL is new, it is added (Orphan found!).

## Checkpoints

- [ ] Create `packages/core/src/sitemap.ts`.
- [ ] Add `discovery` section to `ScannerConfig`.
- [ ] Update `Orchestrator` to trigger sitemap fetch before spawning workers.
- [ ] Update `DiscoveryWorker` to handle the pre-filled queue.

## Confirmation Tests

```typescript
// tests/sitemap.test.ts
test("hybrid mode finds orphans", async () => {
  // 1. Mock sitemap with /page-a, /page-b
  // 2. Mock site HTML where /page-a links to /page-c (orphan)
  // 3. Run scan
  // 4. Assert Queue contains A, B, and C.
});
```
