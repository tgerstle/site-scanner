# Phase 3: Discovery Worker (Crawler)

## Overview

The Discovery Worker is a fast, lightweight process responsible for crawling a site, extracting links, and populating the SQLite queue. It uses Playwright but aggressively blocks heavy assets (images, CSS, fonts) to maximize speed. It must respect the `ScannerConfig` (e.g., `includePaths`, `excludePaths`, `maxDepth`).

## Detailed Checklist

- [x] **3.1 Playwright Optimization**
  - [x] Implement a Playwright setup function that blocks images, CSS, fonts, and media.
  - [x] Disable unnecessary browser features (e.g., geolocation, notifications).
- [x] **3.2 Link Extraction**
  - [x] Implement logic to extract all `href` attributes from `<a>` tags on a page.
  - [x] Normalize URLs (resolve relative paths, remove fragments/hashes).
- [x] **3.3 URL Filtering & Validation**
  - [x] Filter out external domains (stay within `ScannerConfig.siteUrl`).
  - [x] Apply `includePaths` and `excludePaths` regex/string matching.
- [x] **3.4 Queue Population**
  - [x] Insert discovered URLs into the `queue` table.
  - [x] Handle `UNIQUE` constraints gracefully (ignore already queued URLs).
  - [x] Increment the `depth` counter for newly discovered links.
- [x] **3.5 Worker Loop Integration**
  - [x] Integrate the discovery logic into the worker's polling loop.

## Types & Interfaces

```typescript
// packages/types/src/discovery.ts
export interface DiscoveryResult {
  foundUrls: string[];
  error?: string;
}

export interface LinkFilterOptions {
  baseUrl: string;
  includePaths?: string[];
  excludePaths?: string[];
}
```

## Code Example: Fast Crawling & Filtering

```typescript
// packages/core/src/discovery.ts
import { chromium, BrowserContext } from "playwright";

export async function setupFastContext(): Promise<BrowserContext> {
  const browser = await chromium.launch();
  const context = await browser.newContext();

  // Block heavy assets for speed
  await context.route("**/*.{png,jpg,jpeg,gif,svg,css,woff,woff2,mp4,webm}", (route) =>
    route.abort(),
  );

  return context;
}

export function filterLinks(links: string[], options: LinkFilterOptions): string[] {
  const base = new URL(options.baseUrl);

  return (
    links
      .map((link) => {
        try {
          return new URL(link, base.origin);
        } catch {
          return null;
        }
      })
      .filter((url): url is URL => url !== null)
      .filter((url) => url.hostname === base.hostname) // Stay on same domain
      .map((url) => {
        url.hash = ""; // Remove fragments
        return url.toString();
      })
      // Apply include/exclude logic here...
      .filter((value, index, self) => self.indexOf(value) === index)
  ); // Deduplicate
}
```

## Testing Requirements

- [x] **Test 3.1**: `setupFastContext` successfully blocks image and CSS requests (verify via Playwright request interception mock).
- [x] **Test 3.2**: `filterLinks` correctly resolves relative URLs, removes fragments, and filters out external domains.
- [x] **Test 3.3**: `filterLinks` correctly applies `includePaths` and `excludePaths` from the configuration.
- [x] **Test 3.4**: Discovery worker extracts all valid `href` attributes from a static HTML fixture (`tests/fixtures/links.html`).
- [x] **Test 3.5**: Discovery worker correctly inserts new URLs into the `queue` table without duplicating existing entries.
