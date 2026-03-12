# Phase 1: Monorepo Setup, Tooling & Database Core

## Overview

This phase establishes the foundation of the Adaptive Web Auditor (AWA). It sets up the monorepo structure, configures strict TypeScript, integrates Biome for linting/formatting, and Vitest for testing. Crucially, it implements the SQLite database (in WAL mode) which acts as the single source of truth for the entire system, and defines the configuration schema.

## Detailed Checklist

- [ ] **1.1 Workspace Initialization**
  - [ ] Initialize `package.json` with npm workspaces (`apps/*`, `packages/*`).
  - [ ] Create directories: `apps/web`, `packages/core`, `packages/db`, `packages/types`.
- [ ] **1.2 Tooling Configuration**
  - [ ] Create a base `tsconfig.json` with `"strict": true` and extend it in packages.
  - [ ] Install and configure Biome (`biome.json`) for formatting and linting.
  - [ ] Install and configure Vitest at the workspace root.
- [ ] **1.3 Configuration Schema (Zod)**
  - [ ] Define `ScannerConfig` interface in `packages/types`.
  - [ ] Implement Zod validation for the configuration.
  - [ ] Support loading configuration from a JSON file (e.g. `awaconfig.json`) to allow repeatable script runs and ensure consistent output locations.
- [ ] **1.4 Database Core**
  - [ ] Install `better-sqlite3`.
  - [ ] Implement DB connection utility enforcing WAL mode (`PRAGMA journal_mode = WAL;`).
  - [ ] Write SQL migration/initialization script for core tables (`runs`, `queue`, `results`, `heartbeats`).
- [ ] **1.5 Atomic Queue Logic**
  - [ ] Implement `claimNextJob` using `UPDATE ... RETURNING` to prevent race conditions.

## Types & Interfaces

```typescript
// packages/types/src/config.ts
import { z } from "zod";

export const ScannerConfigSchema = z.object({
  siteUrl: z.string().url(),
  includePaths: z.array(z.string()).optional(),
  excludePaths: z.array(z.string()).optional(),
  plugins: z.array(z.string()).default(["axe", "lighthouse"]),
  outputFormat: z.enum(["json", "sqlite", "both"]).default("sqlite"),
  outputDir: z.string().default("./artifacts"), // Control where specific outputs go
  maxDepth: z.number().min(1).default(3),
});

export type ScannerConfig = z.infer<typeof ScannerConfigSchema>;

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

## Code Example: Database Initialization & Atomic Claim

```typescript
// packages/db/src/connection.ts
import Database from "better-sqlite3";

export function getDb(dbPath: string) {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  return db;
}

// packages/db/src/queue.ts
export function claimNextJob(
  db: Database.Database,
  workerId: string,
  role: WorkerRole,
): QueueRow | null {
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

## Testing Requirements

- [ ] **Test 1.1**: `ScannerConfigSchema` correctly parses valid configs and rejects invalid URLs or negative depths.
- [ ] **Test 1.1b**: Config utility successfully loads and validates a JSON configuration file.
- [ ] **Test 1.2**: `getDb` successfully creates an in-memory database (`:memory:`) and sets WAL mode.
- [ ] **Test 1.3**: Database schema initialization creates all required tables without errors.
- [ ] **Test 1.4**: `claimNextJob` atomically assigns a job. When called concurrently by multiple simulated workers, no two workers receive the same job ID.
