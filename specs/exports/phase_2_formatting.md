# Phase 2: Output Formats & Generators

## Overview

Once Phase 1 successfully flattens the raw database JSON into distinct plugin arrays, we need universal generator functions that can turn those arrays into binary file buffers (XLSX and ZIP of CSVs). These generators must live in `packages/core` so both the CLI (Command Line) and the Web API can use them identically.

We will introduce two new dependencies to `packages/core/package.json`:

- `exceljs` (for multi-tab XLSX files)
- `archiver` and `csv-stringify` (to create zipped bundles of CSV files)

## Code Specifics

### 1. The Export Generator Service (`packages/core/src/export-generator.ts`)

Create a new file handling the file generation, accepting the `ExportDatasets` generated in Phase 1.

```typescript
// packages/core/src/export-generator.ts
import ExcelJS from "exceljs";
import { stringify } from "csv-stringify/sync";
import archiver from "archiver";
import type { ExportDatasets } from "types";

/**
 * Generates an XLSX file Buffer.
 * Each key in the ExportDatasets object becomes a separate WorkSheet tab.
 */
export async function generateXlsxBuffer(
  datasets: ExportDatasets,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  // Tab 1: Global Rollup Sheet
  const globalSheet = workbook.addWorksheet("Global Action Plan");
  globalSheet.columns = [
    { header: "Severity", key: "severity", width: 15 },
    { header: "Plugin", key: "plugin", width: 15 },
    { header: "Rule ID", key: "ruleId", width: 25 },
    { header: "Total Occurrences", key: "totalOccurrences", width: 15 },
    { header: "Affected URLs", key: "affectedUrls", width: 15 },
    { header: "Description", key: "description", width: 50 },
  ];
  globalSheet.addRows(datasets.global);

  // Tab 2: Axe Audit Sheet
  const axeSheet = workbook.addWorksheet("Accessibility Audit");
  axeSheet.columns = [
    { header: "URL", key: "url", width: 40 },
    { header: "Impact", key: "impact", width: 15 },
    { header: "Rule ID", key: "ruleId", width: 25 },
    { header: "Selector (Target)", key: "targetSelector", width: 40 },
    { header: "HTML Snippet", key: "htmlSnippet", width: 50 },
    { header: "Failure Summary", key: "failureSummary", width: 60 },
  ];
  axeSheet.addRows(datasets.a11y);

  // Tab 3: Performance Sheet
  const perfSheet = workbook.addWorksheet("Performance Audit");
  perfSheet.columns = [
    { header: "URL", key: "url", width: 40 },
    { header: "Audit Title", key: "title", width: 35 },
    { header: "Score", key: "score", width: 10 },
    { header: "Savings (ms)", key: "potentialSavingsMs", width: 15 },
    { header: "Resource/Hint", key: "resourceHint", width: 50 },
  ];
  perfSheet.addRows(datasets.performance);

  // Tab 4: SEO Sheet
  const seoSheet = workbook.addWorksheet("SEO Audit");
  seoSheet.columns = [
    { header: "URL", key: "url", width: 40 },
    { header: "Issue Type", key: "issueType", width: 15 },
    { header: "Status", key: "status", width: 10 },
    { header: "Path", key: "propertyPath", width: 25 },
    { header: "Message", key: "message", width: 50 },
  ];
  seoSheet.addRows(datasets.seo);

  // Write to Buffer
  return (await workbook.xlsx.writeBuffer()) as Buffer;
}

/**
 * Generates a ZIP Buffer containing multiple .csv files
 */
export async function generateCsvZipBuffer(
  datasets: ExportDatasets,
): Promise<Buffer> {
  // 1. Convert arrays to CSV strings using `csv-stringify`
  //    e.g., const axeCsv = stringify(datasets.a11y, { header: true })
  // 2. Wrap those strings into a Node archiving pipeline using `archiver`
  //    e.g., archive.append(axeCsv, { name: 'accessibility-audit.csv' })
  // 3. Return the finalized Zip stream as a Promise<Buffer>
}
```

## Testing Plan

1. **Unit Test: XLSX Generation**
   - **Action**: Pass a mocked `ExportDatasets` into `generateXlsxBuffer`.
   - **Expectation**: Read the returned `Buffer` using `exceljs`, assert that the workbook contains exactly four worksheets, properly named according to the 1 Tab = 1 Plugin strategy. Assert that row counts match the inputs.
2. **Unit Test: CSV/ZIP Generation**
   - **Action**: Pass the same mock into `generateCsvZipBuffer`.
   - **Expectation**: Returned `Buffer` is a valid ZIP archive containing `global-action-plan.csv`, `accessibility-audit.csv`, etc. Validating the CSV splits via parsing to ensure no data loss occurs when skipping XLSX.
