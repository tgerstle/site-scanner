# Phase 6: Frontend Dashboard (Astro + React)

## Overview

This phase builds a local dashboard to visualize the results stored in the SQLite database and act as a control panel. It uses Astro for fast, server-rendered pages, React for interactive components, and Tailwind CSS for styling. The dashboard provides an overview of the audit progress, detailed reports for individual URLs, and allows triggering new audits using customizable configurations.

## Detailed Checklist

- [ ] **6.1 Astro Initialization**
  - [ ] Initialize an Astro project in `apps/web`.
  - [ ] Add React and Tailwind CSS integrations (`npx astro add react tailwind`).
- [ ] **6.2 Database Integration**
  - [ ] Import the shared `getDb` utility from `packages/db`.
  - [ ] Write queries to fetch aggregate stats (total URLs, pending, completed, total violations).
  - [ ] Write queries to fetch detailed results for a specific URL.
- [ ] **6.3 Dashboard Components (React)**
  - [ ] Build an `OverviewStats` component to display high-level metrics.
  - [ ] Build a `QueueTable` component to show the status of crawled URLs.
  - [ ] Build a `ViolationList` component to display accessibility/SEO issues.
  - [ ] Build a `RunTrigger` component allowing users to configure and trigger a scan from the UI.
- [ ] **6.4 Page Structure (Astro)**
  - [ ] Create `src/pages/index.astro` for the main dashboard view.
  - [ ] Create `src/pages/url/[id].astro` for detailed URL reports.
  - [ ] Create an API route `src/pages/api/trigger.ts` to execute the Orchestrator with the provided config.
- [ ] **6.5 Styling**
  - [ ] Apply Tailwind CSS classes for a clean, readable interface.

## Types & Interfaces

```typescript
// apps/web/src/types.ts
export interface DashboardStats {
  totalUrls: number;
  pendingUrls: number;
  completedUrls: number;
  totalViolations: number;
}

export interface UrlReport {
  url: string;
  status: string;
  seo_score: number | null;
  violations: any[];
}
```

## Code Example: Astro DB Query & React Component

```astro
---
// apps/web/src/pages/index.astro
import { getDb } from 'db'; // Shared package
import Dashboard from '../components/Dashboard.tsx';

const db = getDb('./data/awa.db');

// Fetch aggregate stats
const stats = db.prepare(`
  SELECT
    COUNT(*) as totalUrls,
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendingUrls,
    SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completedUrls
  FROM queue
`).get();

const violations = db.prepare('SELECT COUNT(*) as totalViolations FROM a11y_findings').get();

const initialStats = { ...stats, ...violations };
---
<html lang="en">
  <head>
    <title>AWA Dashboard</title>
  </head>
  <body class="bg-gray-50 text-gray-900">
    <main class="container mx-auto p-8">
      <h1 class="text-3xl font-bold mb-8">Audit Dashboard</h1>
      <Dashboard initialStats={initialStats} client:load />
    </main>
  </body>
</html>
```

```tsx
// apps/web/src/components/Dashboard.tsx
import React from "react";
import { DashboardStats } from "../types";

export default function Dashboard({ initialStats }: { initialStats: DashboardStats }) {
  return (
    <div className="grid grid-cols-4 gap-4">
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-sm font-medium text-gray-500">Total URLs</h3>
        <p className="text-2xl font-semibold">{initialStats.totalUrls}</p>
      </div>
      {/* Additional stat cards... */}
    </div>
  );
}
```

## Testing Requirements

- [ ] **Test 6.1**: Astro page successfully connects to the SQLite database and executes queries without errors.
- [ ] **Test 6.2**: React components (`Dashboard`, `QueueTable`) render correctly with mock data.
- [ ] **Test 6.3**: Tailwind CSS classes are correctly applied and compiled in the build output.
