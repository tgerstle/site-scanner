# Spreadsheet Export Architecture & Implementation Plan

## 1. Overview and Goals

- **Objective**: Export scan data into clearly separated, actionable spreadsheets focusing on metrics mapped to how they are visualized on the dashboard.
- **Transparency**: Instead of hyper-normalizing all plugins into a single, diluted sheet, we will maintain the rich context of each plugin's unique data structure by creating plugin-specific output sheets/tabs.
- **Flexibility**: The output format allows new plugins to simply define their own row model and get a dedicated sheet to map accurately to what developers need to solve those specific issues.
- **Developer Experience**: Include an intuitive UI preview of the export tables before downloading to accelerate development and debugging mapping logic.

## 2. Plugin-Specific Data Flattening

Instead of forcing all errors into a universal `NormalizedViolation`, we will craft explicit 1D row models for each plugin.

### Data Flattening Utility

- **Location**: `packages/core/src/normalization.ts`
- **Purpose**: Maps deeply nested database JSON outputs from heterogeneous plugins into flat array models tailored for spreadsheet ingestion.
- **Proposed Interfaces**:
  - `A11yRow`: URL, Rule ID, Impact, HTML Snippet, Target Selector, Fix Summary.
  - `PerformanceRow`: URL, Audit Title, Metric Score, Potential Savings (ms), Resource URL.
  - `SeoRow`: URL, Issue Type, Status, Element/Schema Path.
  - `GlobalRollupRow`: Site-wide aggregated metrics across all tools.

## 3. Output Formats (CSV vs. XLSX)

Based on the requirement for multiple data views, the system will support two output formats:

### A. Format Selection

- **XLSX (Excel)**: Highly recommended for multiple data sets. A library like `exceljs` allows us to generate a single `.xlsx` file containing multiple tabs natively.
- **CSV + ZIP**: Fallback/alternative option where multiple `.csv` files are generated and bundled into a `.zip` archive using `archiver`.

### B. Proposed Sheets/Files (The "1 Tab = 1 Plugin" Strategy)

1. **Global/Action Plan**: Site-wide aggregated rollup (Counts by Rule ID, Severity).
2. **Accessibility Audit**: Flat list of Axe UI violations, focusing on DOM nodes.
3. **Performance Audit**: Flat list of Lighthouse audits, focusing on time savings and loading scores.
4. **SEO Audit**: Flat list of Meta tag mismatches and JSON-LD schema validation errors.

## 4. UI: Export Preview (Development Accelerator)

To aid development and provide transparency:

- **Location**: A new tab or view on the Run Details page (e.g., `/runs/[id]/export-preview`).
- **Functionality**:
  - Fetches the flattened data arrays from the normalizer.
  - Renders the data in basic, unopinionated HTML tables matching their respective spreadsheet tabs (Global, A11y, Perf, SEO).
  - Allows developers and users to verify the exact rows and columns that will end up in the exported file prior to pushing complex CSV/Excel algorithms.

## 5. API Endpoint Encapsulation

- **Endpoint**: `/api/runs/[id]/export.ts`
- **Query Parameters**: `?format=csv` or `?format=xlsx`
- **Behavior**:
  - Retrieves the run and results from the SQLite database.
  - Runs the data through `normalization.ts` to generate the Tab arrays.
  - Depending on the format, creates an Excel workbook (via `exceljs`) or a ZIP file.
  - Streams the appropriate file back to the browser with correct Mime types (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` or `application/zip`) and `<a download>` hooks.
