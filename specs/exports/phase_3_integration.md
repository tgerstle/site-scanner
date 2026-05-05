# Phase 3: Integration (CLI & API Endpoints)

## Overview

This phase exposes the work completed in Phases 1 and 2 to the end users. We must maintain a "CLI-first" paradigm. The core generation logic will be executed identically regardless of whether the user types `awa export` in their terminal, or clicks a download button in the Astro React dashboard.

Currently, the `awa export` CLI tool has a very rudimentary local-only implementation that just dumps the queue statuses. It will be entirely refactored to use our new `GenerateExportDatasets` and `Export Generator` pipelines.

## Code Specifics

### 1. Refactoring the CLI (`packages/cli/src/index.ts`)

We will rewrite the `export` command block to import from `core` instead of manually mapping local data.

```typescript
// Modifications to packages/cli/src/index.ts
import {
  generateExportDatasets,
  generateXlsxBuffer,
  generateCsvZipBuffer,
} from "core";

program
  .command("export")
  .description("Export normalized audit results to XLSX, ZIP(CSV), or JSON")
  .requiredOption("--run-id <id>", "The Run ID to export")
  .option("--format <format>", "Export format (xlsx, csv-zip, json)", "xlsx")
  .option("--output <file>", "Output file path")
  .action(async (options) => {
    const db = getDb(dbPath);
    // 1. Fetch all raw results from DB
    const rawResults = db
      .prepare(`SELECT * FROM results WHERE run_id = ?`)
      .all(options.runId);

    // 2. Normalize out specific Plugin sheets (Phase 1)
    const datasets = generateExportDatasets(rawResults);

    // 3. Generate Buffers (Phase 2)
    let fileBuffer: Buffer;
    if (options.format.toLowerCase() === "xlsx") {
      fileBuffer = await generateXlsxBuffer(datasets);
      const outPath = options.output || `run_${options.runId}.xlsx`;
      fs.writeFileSync(outPath, fileBuffer);
    } else if (options.format.toLowerCase() === "csv-zip") {
      fileBuffer = await generateCsvZipBuffer(datasets);
      const outPath = options.output || `run_${options.runId}.zip`;
      fs.writeFileSync(outPath, fileBuffer);
    }

    console.log(`Export successfully saved to ${outPath}`);
  });
```

### 2. The Dashboard API Endpoint (`apps/web/src/pages/api/runs/[id]/export.ts`)

A server-side endpoint in the Astro frontend wrapper. Because the Astro App structure points to the same underlying SQLite DB, we can duplicate the CLI's exact control flow.

```typescript
// apps/web/src/pages/api/runs/[id]/export.ts
import type { APIRoute } from "astro";
import { getDatabase } from "../../../../lib/db";
import {
  generateExportDatasets,
  generateXlsxBuffer,
  generateCsvZipBuffer,
} from "core";

export const GET: APIRoute = async ({ params, request }) => {
  const runId = params.id as string;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") || "xlsx";

  const db = getDatabase();
  const rawResults = db
    .prepare(`SELECT * FROM results WHERE run_id = ?`)
    .all(runId);

  // Exact same step 2 as the CLI logic
  const datasets = generateExportDatasets(rawResults);

  let buffer: Buffer;
  let contentType = "";
  let fileName = "";

  if (format === "xlsx") {
    buffer = await generateXlsxBuffer(datasets);
    contentType =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    fileName = `audit-${runId}.xlsx`;
  } else {
    buffer = await generateCsvZipBuffer(datasets);
    contentType = "application/zip";
    fileName = `audit-${runId}.zip`;
  }

  return new Response(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
};
```

### 3. Dashboard Download Triggers (`apps/web/src/components/RunDetailHeader.tsx`)

Add standard `<a>` tags or a Dropdown Menu button inside the Run Detail page header that points to `/api/runs/${runId}/export?format=xlsx` and `?format=csv-zip`.

## Testing Plan

1. **CLI Execution Test**:
   - Start an audit using `awa start`. Watch it complete.
   - Run `npm run cli export --run-id <ID> --format xlsx`.
   - Verify that an `.xlsx` file is generated locally and opens without corruption errors in Excel/Numbers.
2. **API Endpoint Test**:
   - Using curl, Postman, or a browser, navigate to `.localhost/api/runs/123/export?format=xlsx`.
   - Verify the download begins, correct headers are set (`Content-Disposition`), and the resulting file acts identically to the CLI generated version.
3. **Database Independence Checks**: Ensure that the web API extraction works smoothly parallel to what Astro is doing so no database locking occurs.
