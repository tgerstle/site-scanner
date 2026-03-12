# Run-Based Results View Specification

## Overview

This specification outlines the updates required to support a "Run-based Results View" in the dashboard. The goal is to allow users to navigate scan results hierarchically: starting from a high-level list of audit runs, drilling down into a specific run's pages, and finally inspecting individual accessibility violations.

## User Flow & UI Components

### 1. Run History List

A new view (or updated Dashboard home) that lists all historical scan sessions.

- **Columns**:
  - **Run ID**: Unique identifier (e.g., `run_174092283...`).
  - **Status**: Visual badge (Running, Completed, Stopped, Failed).
  - **Target/Config**: Starting URL or description (e.g., "Scan of example.com (Depth: 3)").
  - **Date**: Formatted start time & duration.
  - **Summary**: Total Pages Found / Scanned / Violations.
- **Action**: Clicking a row navigates to the **Run Details View**.

### 2. Run Details View

The core interface for analyzing a specific scan.

- **Header Stats**:
  - High-level metrics for _just this run_ (Total Pages, Avg. Violations/Page, Critical Issues).
- **Page List Table** (Sortable):
  - **URL**: The scanned page address.
  - **Status**: HTTP Status (200, 404, 500) or Audit Status (Completed, Failed).
  - **Violations**: Count of total accessibility/SEO issues found on that page.
  - **Depth**: How far from the start URL this page was found.
- **Sorting & Filtering**:
  - **"Most Violations"**: Sort table descending by violation count to prioritize fixes.
  - **"Alphabetical"**: Sort by URL.
  - **"Status"**: Filter to show only Failed/Error pages.

### 3. Violation Details (Drill Down)

An expanded view (modal, drawer, or sub-row) for a specific page.

- **Content**:
  - **Rule ID**: The specific rule violated (e.g., `axe:image-alt`).
  - **Impact**: Severity level (Critical, Serious, Moderate, Minor).
  - **Description**: Human-readable explanation of the issue.
  - **Context**: The specific HTML snippet or DOM selector where the violation occurred.
  - **Help**: Link to remediation documentation (if available from engine).

## Technical Implementation Plan

### Database & Queries (`packages/db`, `apps/web/src/lib`)

1.  **Run List Query (`GET /api/runs`):**

    This query retrieves all runs and aggregates their status counts (completed, failed, etc.) and total violations.

    ```typescript
    // apps/web/src/lib/queries.ts

    export interface RunSummary {
      id: string;
      started_at: string;
      status: string;
      url_count: number;
      violation_count: number;
      config: any;
    }

    export function getRuns(): RunSummary[] {
      const db = getDatabase();

      const sql = `
        SELECT 
          r.id, 
          r.started_at, 
          r.status, 
          r.config_json,
          (SELECT COUNT(*) FROM queue q WHERE q.run_id = r.id) as url_count,
          (SELECT COALESCE(SUM(a.count), 0) FROM a11y_findings a WHERE a.run_id = r.id) as violation_count
        FROM runs r
        ORDER BY r.started_at DESC
      `;

      return db
        .prepare(sql)
        .all()
        .map((row: any) => ({
          ...row,
          config: row.config_json ? JSON.parse(row.config_json) : {},
        }));
    }
    ```

2.  **Run Details Query (`GET /api/runs/[id]`):**

    Fetches detailed metadata for a single run, including page-level stats.

    ```typescript
    // apps/web/src/lib/queries.ts

    export interface RunDetail extends RunSummary {
      pages: PageSummary[];
    }

    export interface PageSummary {
      url: string;
      status: string;
      depth: number;
      violation_count: number;
    }

    export function getRunDetails(runId: string): RunDetail | null {
      const db = getDatabase();

      // Get Run Info
      const run = db.prepare(`SELECT * FROM runs WHERE id = ?`).get(runId);
      if (!run) return null;

      // Get Page List with Violation Counts
      // Optimized to avoid N+1 queries by joining findings
      const pages = db
        .prepare(
          `
        SELECT 
          q.url, 
          q.status, 
          q.depth,
          COALESCE(SUM(a.count), 0) as violation_count
        FROM queue q
        LEFT JOIN a11y_findings a ON q.url = a.url AND q.run_id = a.run_id
        WHERE q.run_id = ?
        GROUP BY q.id
        ORDER BY violation_count DESC
      `,
        )
        .all(runId);

      // Get Aggregate Stats
      const totalViolations = pages.reduce(
        (acc: number, p: any) => acc + p.violation_count,
        0,
      );

      return {
        id: run.id,
        started_at: run.started_at,
        status: run.status,
        config: run.config_json ? JSON.parse(run.config_json) : {},
        url_count: pages.length,
        violation_count: totalViolations,
        pages: pages as PageSummary[],
      };
    }
    ```

3.  **Violation Detail Query (Drill Down):**

    Retrieves specific rule violations for a single page.

    ```typescript
    // apps/web/src/lib/queries.ts

    export function getPageViolations(runId: string, url: string) {
      const db = getDatabase();
      // Note: 'results' table contains the full JSON blob with snippets/selectors
      // We usually want the full 'a11y_violations' JSON from the 'results' table for drilldowns.

      const result = db
        .prepare(
          `
         SELECT a11y_violations 
         FROM results 
         WHERE run_id = ? AND url = ?
       `,
        )
        .get(runId, url);

      return result ? JSON.parse(result.a11y_violations) : [];
    }
    ```

### API Routes (`apps/web/src/pages/api`)

- `GET /api/runs`: Returns `RunSummary[]`.
- `GET /api/runs/[id]`: Returns `RunDetail`.
- `GET /api/runs/[id]/violations?url=...`: Returns detailed violations for a page.

### Frontend Components (`apps/web/src/components`)

**RunListTable.tsx**

```tsx
import { formatDistanceToNow } from "date-fns";

export default function RunListTable({ runs }: { runs: RunSummary[] }) {
  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Status
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Target
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Pages
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Violations
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Date
          </th>
          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
            Action
          </th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {runs.map((run) => (
          <tr key={run.id} className="hover:bg-gray-50">
            <td className="px-6 py-4 whitespace-nowrap">
              <span
                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  run.status === "completed"
                    ? "bg-green-100 text-green-800"
                    : run.status === "running"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-gray-100 text-gray-800"
                }`}
              >
                {run.status}
              </span>
            </td>
            <td className="px-6 py-4 text-sm text-gray-900">
              {run.config.siteUrl || "Custom List"}
            </td>
            <td className="px-6 py-4 text-sm text-gray-500">{run.url_count}</td>
            <td className="px-6 py-4 text-sm text-red-600 font-medium">
              {run.violation_count}
            </td>
            <td className="px-6 py-4 text-sm text-gray-500">
              {run.started_at
                ? formatDistanceToNow(new Date(run.started_at)) + " ago"
                : "N/A"}
            </td>
            <td className="px-6 py-4 text-right text-sm">
              <a
                href={`/runs/${run.id}`}
                className="text-blue-600 hover:text-blue-900"
              >
                View Details
              </a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### Astro Pages (`apps/web/src/pages`)

- `src/pages/runs/index.astro`: The main history view.
- `src/pages/runs/[id].astro`: The detailed run view.
