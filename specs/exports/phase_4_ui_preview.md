# Phase 4: UI Export Preview (Development Accelerator)

## Overview

To improve the developer experience and prevent constant file-downloading while iterating on the data mapping (Phase 1), we will add a live "Export Preview" view to the Dashboard. This view will tap strictly into the same underlying API/Core functions, but instead of rendering headers and buffers, it will just render the raw intermediate datasets into unopinionated HTML `<table>` elements that look and behave like spreadsheet tabs.

## Code Specifics

### 1. Astro Page (`apps/web/src/pages/runs/[id]/export-preview.astro`)

A new navigation route branching off a specific run that loads the normalized array and passes it down to a React component.

```astro
---
// apps/web/src/pages/runs/[id]/export-preview.astro
import Layout from '../../../layouts/Layout.astro';
import { getDatabase } from '../../../lib/db';
import { generateExportDatasets } from 'core';
import ExportPreviewTables from '../../../components/ExportPreviewTables';

const { id } = Astro.params;
const db = getDatabase();
const rawResults = db.prepare(`SELECT * FROM results WHERE run_id = ?`).all(id);

// Directly utilize the exact logic that drives the export file buffers:
const datasets = generateExportDatasets(rawResults);
---

<Layout title={`Export Preview for Run ${id}`}>
   <div class="px-8 py-6 max-w-7xl mx-auto">
      <h1 class="text-2xl font-bold">Export Preview</h1>
      <!-- Render the tables -->
      <ExportPreviewTables client:load datasets={datasets} />
   </div>
</Layout>
```

### 2. React Component (`apps/web/src/components/ExportPreviewTables.tsx`)

A straightforward presentation component that acts as a mock "Spreadsheet". It avoids sophisticated UI styling (like shadows or complex expanding accordions) in favor of standard basic grid mapping.

- It will feature four "Tabs" matching the 4 generated data structures exactly.
- The columns of the `<table>` for each tab will map 1-to-1 with the `columns` defined in `packages/core/src/export-generator.ts`.

```tsx
import React, { useState } from "react";
import type { ExportDatasets } from "types";

export default function ExportPreviewTables({
  datasets,
}: {
  datasets: ExportDatasets;
}) {
  const [view, setView] = useState<"global" | "a11y" | "performance" | "seo">(
    "global",
  );

  return (
    <div>
      {/* Spreadsheet-like Tabs */}
      <div className="flex gap-2 mb-4 border-b">
        <button onClick={() => setView("global")}>Global Action Plan</button>
        <button onClick={() => setView("a11y")}>Accessibility Audit</button>
        <button onClick={() => setView("performance")}>
          Performance Audit
        </button>
        <button onClick={() => setView("seo")}>SEO Audit</button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full">
          {/* Map dynamically over Object.keys(datasets[view][0]) to generate horizontal layout exactly as it will appear in CSV/Excel */}
        </table>
      </div>
    </div>
  );
}
```

### 3. Dashboard Routing

Modify `apps/web/src/components/RunDetailHeader.tsx` to include a link to `/runs/${run.id}/export-preview`.

## Testing Plan

1. **Visual Accuracy vs. Downloaded File**:
   - Compare the output rendered on `/runs/123/export-preview` directly against an exported CSV/XLSX file of the same run.
   - They must hold identical total row counts and precise column placements across all four tabs.
2. **Regression / Mapping Changes**:
   - If an engineer modifies `flattenA11y` in Phase 1, reloading this Astro page should instantly display the manipulated rows for the Accessibility Audit without needing to trigger a fresh download, fulfilling its purpose as a development accelerator.
