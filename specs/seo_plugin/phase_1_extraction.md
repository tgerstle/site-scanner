# Phase 1: Data Extraction & Storage

## Overview

This phase focuses on extending the `core` scanning capabilities to reliably extract SEO-related metadata from pages during the crawl. It introduces a dedicated `SEOMetadataPlugin` that runs within the existing Playwright context. The goal is to capture raw data without judgment (validation happens in Phase 2).

## Objectives - **COMPLETE**

- [x] **1.1 Database Schema Update**
  - Add `seo_result` column (JSON) to the `results` table.
- [x] **1.2 Plugin Architecture**
  - Create `packages/plugins/src/seo-metadata.ts`.
  - Register the plugin in `packages/core`.
- [x] **1.3 UI Integration**
  - Update `RunTrigger.tsx` to include `seo-metadata` in the available plugins list.
  - Ensure API endpoint (`trigger.ts`) parses and passes the `plugin` array correctly.
- [x] **1.4 Robust Extraction Logic**
  - Extract Standard Meta Tags (`title`, `description`, `robots`, `canonical`, `viewport`, `charset`).
  - Extract OpenGraph Tags (`og:*`).
  - Extract Twitter Card Tags (`twitter:*`).
  - Extract JSON-LD (`<script type="application/ld+json">`).
  - Extract H-Tag Hierarchy (`h1`-`h6` structure).

## Technical Implementation

### Data Structure (Database)

The `seo_result` column will store a JSON object adhering to:

```typescript
interface SeoResult {
  meta: {
    title: string | null;
    description: string | null;
    canonical: string | null;
    robots: string | null;
    viewport: string | null;
    charset: string | null;
    generator: string | null;
  };
  openGraph: Record<string, string>; // e.g., { 'og:title': '...', 'og:image': '...' }
  twitter: Record<string, string>; // e.g., { 'twitter:card': 'summary' }
  jsonLd: Array<Record<string, any>>; // Array of parsed JSON-LD objects
  headings: Array<{ level: number; text: string }>;
  images: Array<{ src: string; alt: string; loading?: string }>; // Basic image inventory for SEO
}
```

### CLI Command

Implementation must be verifiable via CLI.

```bash
# Run a specific scan with only the seo plugin active
npm run cli scan --url https://example.com --plugins seo-metadata
```

### Performance Considerations

- **Execution Context**: Run extraction _inside_ the existing Playwright page context using `page.evaluate()`. This avoids a second network request.
- **Parsing**: `cheerio` is not needed if we use browser DOM API efficiently. JSON-LD parsing (`JSON.parse`) should handle errors gracefully to avoid crashing the scan.

## Testing Plan (`tests/seo-extraction.test.ts`)

1.  **Unit Test: Extractor Logic**
    - Mock a Playwright page with specific HTML fixtures (valid tags, missing tags, malformed JSON-LD).
    - Assert the returned `SeoResult` object matches expected structure.
2.  **Integration Test: Database Storage**
    - Run a meaningful scan against a local fixture server.
    - Query the SQLite database to ensure `seo_result` is populated correctly.

## Verification

Run the following to verify Phase 1:

```bash
# 1. Start local fixture
npm run test:fixtures &
# 2. Run scanner
npm run cli scan --url http://localhost:3000/seo-test-page
# 3. Check DB
sqlite3 data/awa.db "SELECT json_extract(seo_result, '$.meta.title') FROM results WHERE url LIKE '%seo-test-page%';"
```
