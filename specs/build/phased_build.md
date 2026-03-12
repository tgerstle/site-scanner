# AWA Phased Build Specification

## Global Outline

- [x] **Phase 1: Monorepo Setup, Tooling & Database Core**
- [x] **Phase 2: Orchestrator & Worker IPC**
- [ ] **Phase 3: Discovery Worker (Crawler)**
- [ ] **Phase 4: Audit Worker & Plugin Pipeline**
- [ ] **Phase 5: CLI & Observability**
- [ ] **Phase 6: Frontend Dashboard (Astro + React)**

---

## Phase 1: Monorepo Setup, Tooling & Database Core

**Goal**: Initialize the workspace, configure Biome/Vitest/TypeScript, establish the SQLite database as the single source of truth, and define the configuration schema.

### Types & Interfaces

```typescript
// packages/types/src/config.ts
export interface ScannerConfig {
  siteUrl: string;
  includePaths?: string[]; // e.g., ['/blog', '/docs']
  excludePaths?: string[];
  plugins: string[]; // e.g., ['axe', 'lighthouse', 'custom-seo']
  outputFormat?: "json" | "sqlite";
  maxDepth?: number;
}

// packages/types/src/db.ts
export type WorkerRole = "discovery" | "audit";
export type QueueStatus = "pending" | "processing" | "done" | "failed";

export interface QueueRow {
  id: number;
  run_id: string;
  url: string;
  status: QueueStatus;
  depth: number;
  priority: number;
  worker_id: string | null;
}
```

### Code Example: Atomic Claim

```typescript
// packages/db/src/queue.ts
export function claimNextJob(db: Database, workerId: string, role: WorkerRole): QueueRow | null {
  const stmt = db.prepare(`
    UPDATE queue 
    SET status = 'processing', worker_id = ? 
    WHERE id = (
      SELECT id FROM queue 
      WHERE status = 'pending' 
      ORDER BY priority DESC, id ASC 
      LIMIT 1
    )
    RETURNING *;
  `);
  return stmt.get(workerId) as QueueRow | null;
}
```

### Testing Requirements

- [ ] **Test**: Verify Biome formatting and linting runs successfully.
- [ ] **Test**: Verify SQLite WAL mode is enabled on connection.
- [ ] **Test**: `claimNextJob` atomically assigns a job and prevents race conditions (simulate concurrent calls).
- [ ] **Test**: Configuration parser correctly validates and applies `ScannerConfig` (e.g., specific paths, selected plugins).

### Checklist

- [ ] Initialize npm workspace with `apps/web`, `packages/core`, `packages/db`, `packages/types`.
- [ ] Configure `tsconfig.json` for strict mode across all packages.
- [ ] Install and configure Biome (`biome.json`).
- [ ] Install and configure Vitest.
- [ ] Define `ScannerConfig` interface and validation logic (e.g., using Zod).
- [ ] Implement SQLite connection utility with WAL mode (`better-sqlite3`).
- [ ] Create initial database schema (runs, queue, results, heartbeats).
- [ ] Implement atomic queue claiming logic.

---

## Phase 2: Orchestrator & Worker IPC

**Goal**: Build the Orchestrator to spawn, monitor, and restart Node.js child processes (workers).

### Types & Interfaces

```typescript
// packages/types/src/worker.ts
export interface HeartbeatMessage {
  type: "heartbeat";
  worker_id: string;
  role: WorkerRole;
  timestamp: number;
}
```

### Code Example: Worker Spawning

```typescript
// packages/core/src/orchestrator.ts
import { fork } from "child_process";

export function spawnWorker(role: WorkerRole, workerId: string) {
  const worker = fork("./dist/worker.js", [role, workerId]);
  worker.on("message", (msg: HeartbeatMessage) => {
    updateHeartbeatInDb(msg.worker_id, msg.role, msg.timestamp);
  });
  return worker;
}
```

### Testing Requirements

- [ ] **Test**: Orchestrator successfully spawns a child process.
- [ ] **Test**: Orchestrator receives heartbeat messages and updates the DB.
- [ ] **Test**: Orchestrator detects a dead worker (stale heartbeat > 60s) and resets its queue items to 'pending'.

### Checklist

- [ ] Implement Orchestrator class.
- [ ] Implement worker entry point (`worker.ts`).
- [ ] Implement heartbeat broadcasting from workers.
- [ ] Implement zombie detection and queue resetting in Orchestrator.

---

## Phase 3: Discovery Worker (Crawler)

**Goal**: Implement the lightweight crawler to find links and populate the queue.

### Types & Interfaces

```typescript
// packages/types/src/discovery.ts
export interface DiscoveryResult {
  foundUrls: string[];
  error?: string;
}
```

### Code Example: Fast Crawling

```typescript
// packages/core/src/discovery.ts
import { chromium } from "playwright";

export async function discoverLinks(url: string): Promise<string[]> {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  // Block images/css for speed
  await context.route("**/*.{png,jpg,jpeg,css,woff,woff2}", (route) => route.abort());
  const page = await context.newPage();
  await page.goto(url);
  const links = await page.$$eval("a", (anchors) => anchors.map((a) => a.href));
  await browser.close();
  return links;
}
```

### Testing Requirements

- [ ] **Test**: Discovery worker extracts all valid `href` attributes from a static HTML fixture.
- [ ] **Test**: Discovery worker ignores external domains (if configured).
- [ ] **Test**: Discovery worker correctly inserts new URLs into the `queue` table.

### Checklist

- [ ] Implement Playwright setup for Discovery (blocking heavy assets).
- [ ] Implement link extraction logic.
- [ ] Implement queue population logic (avoiding duplicates).
- [ ] Integrate Discovery logic into the worker loop.

---

## Phase 4: Audit Worker & Plugin Pipeline

**Goal**: Implement the heavyweight audit worker and the middleware-based plugin pipeline.

### Types & Interfaces

```typescript
// packages/types/src/audit.ts
export interface AuditContext {
  run_id: string;
  url: string;
  page: any; // Playwright Page
  results: Partial<any>;
  log: (msg: string) => void;
  flags: { hasErrors: boolean };
}

export interface AuditPlugin {
  name: string;
  run(ctx: AuditContext): Promise<void>;
}
```

### Code Example: Plugin Execution

```typescript
// packages/core/src/pipeline.ts
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
```

### Testing Requirements

- [ ] **Test**: Pipeline executes plugins in the correct order based on `ScannerConfig`.
- [ ] **Test**: Axe plugin correctly identifies accessibility violations in `tests/fixtures/missing-labels.html`.
- [ ] **Test**: Pipeline gracefully handles a plugin throwing an error without crashing the worker.
- [ ] **Test**: Custom Playwright plugin successfully extracts specific data from a page.

### Checklist

- [ ] Define `AuditContext` and `AuditPlugin` interfaces.
- [ ] Implement the pipeline runner that respects `ScannerConfig.plugins`.
- [ ] Implement Axe-core plugin (`@axe-core/playwright`).
- [ ] Implement Lighthouse/SEO plugin.
- [ ] Implement a generic Playwright data extraction plugin (for custom data scraping).
- [ ] Implement result saving to the `results` and `a11y_findings` tables based on `ScannerConfig.outputFormat`.

---

## Phase 5: CLI & Observability

**Goal**: Create the command-line interface and implement NDJSON logging.

### Types & Interfaces

```typescript
// packages/types/src/logging.ts
export interface LogEvent {
  event: string;
  plugin?: string;
  url?: string;
  severity: "info" | "warn" | "error";
  message: string;
}
```

### Code Example: NDJSON Logger

```typescript
// packages/core/src/logger.ts
export function logEvent(event: LogEvent) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), ...event }));
}
```

### Testing Requirements

- [ ] **Test**: Logger outputs valid JSON strings.
- [ ] **Test**: CLI parses arguments correctly (e.g., `--url`, `--format json`).

### Checklist

- [ ] Implement NDJSON logger utility.
- [ ] Replace all `console.log` with the structured logger.
- [ ] Build CLI entry point using a library like `commander` or `mri`.
- [ ] Add CLI commands to start a run, view status, and resume a run.

---

## Phase 6: Frontend Dashboard (Astro + React)

**Goal**: Build a local dashboard to visualize the SQLite database results.

### Types & Interfaces

```typescript
// apps/web/src/types.ts
export interface DashboardStats {
  totalUrls: number;
  pendingUrls: number;
  totalViolations: number;
}
```

### Code Example: Astro DB Query

```astro
---
// apps/web/src/pages/index.astro
import { getDb } from 'db'; // Shared package
import Dashboard from '../components/Dashboard.tsx';

const db = getDb();
const stats = db.prepare('SELECT count(*) as total FROM queue').get();
---
<html>
  <body>
    <Dashboard initialStats={stats} client:load />
  </body>
</html>
```

### Testing Requirements

- [ ] **Test**: React components render correctly with mock data.
- [ ] **Test**: Astro page successfully reads from the SQLite database.

### Checklist

- [ ] Initialize Astro project in `apps/web` with React and Tailwind integrations.
- [ ] Create shared DB connection utility accessible by Astro.
- [ ] Build overview dashboard component (React).
- [ ] Build detailed URL report view.
- [ ] Style with Tailwind CSS.
