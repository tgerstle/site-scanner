# Phase 2: Classifier Engine

**Goal:** Implement the logic that takes a URL and a Page (DOM) and determines the `PageType`.

**Status:** Not Started

## 1. The `Classifier` Class

Create `packages/core/src/classifier.ts`.

### Logic Flow

1.  Input: `url` (string) and `page` (Playwright Page).
2.  **Step 1: Content Scrape (High Priority)**
    - Iterate through all configured `definitions`.
    - If a definition has a `selector`, attempt to find it on the page.
    - If found -> Return matching Type immediately (Short-circuit).
3.  **Step 2: URL Pattern Match (Medium Priority)**
    - If no selector matched, iterate through definitions again.
    - Check `urlPattern` regex.
    - If matching -> Return matching Type.
4.  **Step 3: Fallback**
    - Return `"global"` or `"unknown"`.

### Code Draft

```typescript
// packages/core/src/classifier.ts
import { Page } from "playwright";
import { ScannerConfig, PageDefinition } from "types";

export class PageClassifier {
  constructor(private config: ScannerConfig) {}

  async classify(url: string, page: Page): Promise<string> {
    const definitions = this.config.definitions || {};

    // 1. Check Selectors (Content) - Strongest Signal
    for (const [type, def] of Object.entries(definitions)) {
      if (def.selector) {
        // Use a quick dirty check to avoid waiting
        // Logic: returns true if selector exists
        const exists = await page
          .$(def.selector)
          .then((res) => !!res)
          .catch(() => false);
        if (exists) {
          return type;
        }
      }
    }

    // 2. Check URL Patterns - Weak Signal
    for (const [type, def] of Object.entries(definitions)) {
      if (def.urlPattern) {
        const regex = new RegExp(def.urlPattern);
        if (regex.test(url)) {
          return type;
        }
      }
    }

    return "global";
  }
}
```

## 2. Handling Multiple Matches

**Question:** What if a page matches "Product" _and_ "SpecialOffer"?
**Answer:**

- First match wins? Or return matches list?
- **Design Decision:** Return a **List of Types**.
  - Why? A page effectively _is_ multiple things. It is a "Global" page, it is a "Product" page, and it might be a "Form" page.
  - The Audit Worker will then union the plugin lists for all matched types.

### Revised Logic (Multi-match)

```typescript
// Revised classify method
async classify(url: string, page: Page): Promise<string[]> {
    const matchedTypes: string[] = ["global"]; // Always present

    for (const [type, def] of Object.entries(this.config.definitions || {})) {
        let isMatch = false;

        // Check Selector
        if (def.selector) {
             const exists = await page.$(def.selector).then(res => !!res).catch(() => false);
             if (exists) isMatch = true;
        }

        // Check URL (Only if selector didn't already confirm it? Or always?)
        // Let's say: If selector matches, we are good. If not, check URL.
        if (!isMatch && def.urlPattern) {
             if (new RegExp(def.urlPattern).test(url)) isMatch = true;
        }

        if (isMatch) matchedTypes.push(type);
    }

    return matchedTypes;
}
```

## Checkpoints

- [ ] Create `packages/core/src/classifier.ts`.
- [ ] Implement `classify` method supporting multi-type matching.
- [ ] Unit tests mocking Playwright `Page` object.

## Confirmation Tests

```typescript
// tests/classifier.test.ts
test("identifies product via selector", async () => {
  const mockPage = { $: async (sel) => (sel === ".product" ? true : null) };
  const classifier = new PageClassifier(config);
  const types = await classifier.classify("http://example.com/foo", mockPage);
  expect(types).toContain("product");
});

test("identifies blog via url", async () => {
  const mockPage = { $: async () => null };
  const classifier = new PageClassifier(config);
  const types = await classifier.classify(
    "http://example.com/blog/post-1",
    mockPage,
  );
  expect(types).toContain("article");
});
```
