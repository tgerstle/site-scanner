# Phase 1: Plugin-Specific Flattening

## Overview

The goal of this phase is to structure the complex, deeply-nested JSON outputs from our plugins (Axe DOM nodes, Lighthouse numeric audits, SEO schema arrays) into clean, 1D arrays flat enough to map directly to spreadsheet tabs. Instead of forcing all data into a lowest-common-denominator "normalized" type, each plugin will get its own flat Row type.

## Code Specifics

### 1. New Types (`packages/types/src/export.ts`)

Create a new file to house the flat row definitions to avoid bleeding UI/CLI concerns into base database types. Update `packages/types/src/index.ts` to export it.

```typescript
// packages/types/src/export.ts

export type SeverityLevel = "critical" | "high" | "medium" | "low" | "info";

// Tab 1: Axe
export interface A11yRow {
  url: string;
  impact: string;
  ruleId: string;
  help: string;
  targetSelector: string; // The DOM node path
  htmlSnippet: string; // The failing code
  failureSummary: string; // Explanation of the fix needed
  helpUrl: string;
}

// Tab 2: Lighthouse
export interface PerformanceRow {
  url: string;
  auditId: string;
  title: string;
  score: number | null;
  displayValue: string; // e.g. "1.2 s"
  potentialSavingsMs: number; // Extracted from details for sorting
  resourceHint: string; // e.g., URL of an unoptimized image
  description: string;
}

// Tab 3: Custom SEO
export interface SeoRow {
  url: string;
  issueType: "meta" | "schema" | "opportunity";
  status: "fail" | "warn" | "info";
  message: string;
  schemaType?: string; // If applicable
  propertyPath?: string; // e.g., 'offers.price'
}

// Tab 4: Global Rollup
export interface GlobalRollupRow {
  plugin: string; // 'axe', 'lighthouse', 'seo'
  ruleId: string;
  severity: SeverityLevel | string;
  totalOccurrences: number;
  affectedUrls: number;
  description: string;
}

export interface ExportDatasets {
  global: GlobalRollupRow[];
  a11y: A11yRow[];
  performance: PerformanceRow[];
  seo: SeoRow[];
}
```

### 2. Flattening Engine (`packages/core/src/normalization.ts`)

Create utilities to flatten row data out of the `rawDbResults`.

```typescript
// packages/core/src/normalization.ts

import type {
  ExportDatasets,
  A11yRow,
  PerformanceRow,
  SeoRow,
  GlobalRollupRow,
} from "types";

export function flattenA11y(dbResults: any[]): A11yRow[] {
  // Reduces the database results. Loops through a11y_findings.
  // Expands nested `nodes` arrays so EVERY node is its own A11yRow string.
}

export function flattenPerformance(dbResults: any[]): PerformanceRow[] {
  // Loops through performance_findings.
  // Safely parses `details_json` to extract `overallSavingsMs` and resource URLs.
}

export function flattenSeo(dbResults: any[]): SeoRow[] {
  // Loops through seo_result json.
  // Creates rows for meta validation errors and schema validation arrays.
}

export function generateGlobalRollup(
  datasets: Omit<ExportDatasets, "global">,
): GlobalRollupRow[] {
  // Loops through A11y, Performance, and SEO rows.
  // Maps counts and unique URLs grouped by RuleId and Plugin.
}

export function generateExportDatasets(dbResults: any[]): ExportDatasets {
  const a11y = flattenA11y(dbResults);
  const performance = flattenPerformance(dbResults);
  const seo = flattenSeo(dbResults);
  const global = generateGlobalRollup({ a11y, performance, seo });

  return { global, a11y, performance, seo };
}
```

## Testing Plan

1. **Unit Test: `flattenA11y`**
   - **Action**: Pass a mocked `dbResults` entry containing an Axe violation with 3 `nodes`.
   - **Expectation**: Function returns an array of exactly 3 `A11yRow` objects, each carrying the parent `url`, `ruleId`, but with unique `targetSelector` and `htmlSnippet` strings.
2. **Unit Test: `flattenPerformance`**
   - **Action**: Pass a `performance_findings` array containing an unoptimized image audit.
   - **Expectation**: Ensure the function safely extracts `details_json.overallSavingsMs` into the `potentialSavingsMs` property.
3. **Unit Test: `generateGlobalRollup`**
   - **Action**: Pass 5 `A11yRow` items (3 from the same rule on different URLs, 2 from another).
   - **Expectation**: Output array contains 2 objects. The first has `totalOccurrences: 3` and `affectedUrls: (count of unique URLs)` correctly mapped.
