# Phase 4: Audit Worker & Plugin Pipeline

## Overview

The Audit Worker is the heavyweight process that runs the full audit pipeline on a single URL. It uses a middleware-based plugin architecture, allowing different audits (e.g., Axe-core, Lighthouse, custom Playwright scripts) to be executed sequentially based on the `ScannerConfig`.

## Detailed Checklist

- [x] **4.1 Plugin Architecture**
  - [x] Define `AuditContext` and `AuditPlugin` interfaces.
  - [x] Implement the pipeline runner that executes plugins in order.
  - [x] Ensure the pipeline respects `ScannerConfig.plugins`.
- [x] **4.2 Axe-core Plugin**
  - [x] Implement the `@axe-core/playwright` plugin for accessibility testing.
  - [x] Map Axe violations to the `a11y_findings` database schema.
- [x] **4.3 Lighthouse/SEO Plugin**
  - [x] Implement the `playwright-lighthouse` plugin for SEO and performance metrics.
  - [x] Map Lighthouse scores to the `results` database schema.
- [x] **4.4 Custom Playwright Extraction Plugin**
  - [x] Implement a generic plugin that can execute custom Playwright scripts to extract specific data from a page (e.g., meta tags, specific DOM elements).
- [x] **4.5 Result Saving**
  - [x] Implement logic to save the aggregated `AuditContext.results` to the `results` and `a11y_findings` tables.
  - [x] Handle `ScannerConfig.outputFormat` (e.g., save to SQLite or output as JSON).
- [x] **4.6 Error Handling & Artifacts**
  - [x] Implement graceful error handling within the pipeline (a failing plugin should not crash the worker).
  - [x] Implement logic to capture screenshots or traces if a plugin fails or violations exceed a threshold.

## Types & Interfaces

```typescript
// packages/types/src/audit.ts
import { Page } from "playwright";

export interface AuditContext {
  run_id: string;
  url: string;
  page: Page;
  results: Partial<AuditResults>;
  log: (msg: string) => void;
  flags: { hasErrors: boolean };
}

export interface AuditResults {
  seo_score?: number;
  a11y_violations?: any[];
  custom_data?: Record<string, any>;
  screenshot_path?: string;
}

export interface AuditPlugin {
  name: string;
  run(ctx: AuditContext): Promise<void>;
}
```

## Code Example: Plugin Execution & Custom Extraction

```typescript
// packages/core/src/pipeline.ts
import { AuditContext, AuditPlugin } from "types/audit";

export async function runPipeline(ctx: AuditContext, plugins: AuditPlugin[]) {
  for (const plugin of plugins) {
    try {
      await plugin.run(ctx);
    } catch (err) {
      ctx.flags.hasErrors = true;
      ctx.log(`Plugin ${plugin.name} failed: ${err.message}`);
    }
  }
}

// packages/plugins/src/custom-extractor.ts
import { AuditPlugin, AuditContext } from "types/audit";

export const CustomExtractorPlugin: AuditPlugin = {
  name: "custom-extractor",
  async run(ctx: AuditContext) {
    // Example: Extract the meta description
    const description = await ctx.page
      .$eval('meta[name="description"]', (el) => el.getAttribute("content"))
      .catch(() => null);

    ctx.results.custom_data = {
      ...ctx.results.custom_data,
      metaDescription: description,
    };
  },
};
```

## Testing Requirements

- [x] **Test 4.1**: Pipeline executes plugins in the correct order based on `ScannerConfig.plugins`.
- [x] **Test 4.2**: Axe plugin correctly identifies accessibility violations in `tests/fixtures/missing-labels.html`.
- [x] **Test 4.3**: Pipeline gracefully handles a plugin throwing an error without crashing the worker.
- [x] **Test 4.4**: Custom Playwright plugin successfully extracts specific data (e.g., meta description) from a static HTML fixture.
- [x] **Test 4.5**: Audit results are correctly saved to the `results` and `a11y_findings` tables.
