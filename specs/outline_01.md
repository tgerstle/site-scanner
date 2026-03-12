# **Project Specification: Adaptive Web Auditor (AWA)**

## **Purpose & Design Philosophy**

**Adaptive Web Auditor (AWA)** is a **local-first**, **high-performance**, and **agent-native** web crawler and auditing system designed to identify:

- SEO issues
- Structural HTML problems
- Accessibility (A11y) violations
- Interaction and keyboard traps

The system prioritizes:

- Deterministic behavior
- Fault isolation
- Observability
- Resume-safe execution
- Human + AI usability

SQLite is the **single source of truth** for system state.

---

## **1. System Architecture**

### 1.1 High-Level Model

AWA uses a **Decoupled Producer–Consumer architecture** implemented with **Node.js child processes**.

```text
Orchestrator
├── Discovery Workers (fast, lightweight)
├── Audit Workers (slow, heavyweight)
└── SQLite Database (coordination + state)
```

All coordination, progress tracking, and recovery logic is driven by database state.

---

### 1.2 Orchestrator Responsibilities (Intentionally Dumb)

The Orchestrator:

- Spawns and monitors workers
- Assigns work via atomic database queries
- Tracks worker heartbeats
- Restarts failed or stalled workers
- Exposes the CLI interface

The Orchestrator **does not**:

- Perform audits
- Contain crawl logic
- Interpret audit results

All decisions must be driven by:

- Database state
- Plugin configuration
- Worker role definitions

---

### 1.3 Worker Roles

Workers are isolated Node.js child processes and declare an explicit role:

```ts
type WorkerRole = "discovery" | "audit";
```

| Role             | Purpose                                      |
| ---------------- | -------------------------------------------- |
| Discovery Worker | Crawl links and sitemaps, populate the queue |
| Audit Worker     | Run full audit pipeline on a single URL      |

Worker role is persisted in the database for observability and safety.

---

## **2. Runtime & Technology Stack**

### 2.1 Core Stack

- **Runtime:** Node.js + TypeScript
- **Browser Automation:** Playwright
- **Database:** SQLite + WAL mode
- **Driver:** `better-sqlite3`
- **Logging:** `Pino` or `Winston` (NDJSON only)

---

### 2.2 Analysis Engines

| Category            | Tool                                                  |
| ------------------- | ----------------------------------------------------- |
| Accessibility       | `@axe-core/playwright` (primary), `pa11y` (secondary) |
| SEO & Performance   | `playwright-lighthouse`                               |
| Interaction Testing | Custom Playwright scripts                             |

---

## **3. Database Architecture**

### 3.1 SQLite as the System Brain

- WAL mode is mandatory
- SQLite is authoritative for:
  - Queue state
  - Worker health
  - Audit results
  - Run history

The system must be fully resumable after interruption.

---

### 3.2 Core Tables

#### `runs`

Tracks individual audit executions.

| Column      | Purpose                     |
| ----------- | --------------------------- |
| id          | Unique run identifier       |
| started_at  | Timestamp                   |
| config_hash | Hash of audit configuration |

---

#### `queue`

Tracks crawl and audit work.

| Column    | Purpose                              |
| --------- | ------------------------------------ |
| id        | Primary key                          |
| run_id    | Associated run                       |
| url       | Target URL                           |
| status    | pending / processing / done / failed |
| depth     | Crawl depth                          |
| priority  | Processing priority                  |
| worker_id | Claimed worker                       |

---

#### `results`

Stores audit outputs.

| Column          | Purpose            |
| --------------- | ------------------ |
| run_id          | Associated run     |
| url             | Audited URL        |
| timestamp       | Audit time         |
| seo_score       | Derived score      |
| a11y_violations | Raw JSON           |
| screenshot_path | Artifact reference |

---

#### `a11y_findings` (Derived)

Normalized accessibility issues for querying.

| Column  | Purpose       |
| ------- | ------------- |
| run_id  | Run reference |
| url     | Page          |
| rule_id | Axe rule      |
| impact  | Severity      |
| count   | Occurrences   |

---

#### `heartbeats`

Tracks worker health.

| Column    | Purpose           |
| --------- | ----------------- |
| worker_id | Worker identifier |
| role      | discovery / audit |
| last_seen | Timestamp         |

---

## **4. Queue Management & Backpressure**

### 4.1 Atomic Work Claiming

Workers **must claim work atomically** to avoid race conditions.

- No SELECT + UPDATE patterns
- All work acquisition uses a single UPDATE … RETURNING query

This ensures:

- No duplicate processing
- Safe concurrency
- Deterministic recovery

---

### 4.2 Zombie Detection

The Orchestrator:

- Monitors heartbeats
- Resets stalled queue items if `last_seen > 60s`
- Restarts dead workers automatically

---

## **5. Audit Pipeline Architecture**

### 5.1 Middleware-Based Plugin Pipeline

Audits are executed as a **strictly ordered plugin pipeline**.

Default order:

1. Preparation & Navigation
2. SEO Analysis
3. Accessibility Analysis
4. Interaction Testing
5. Evidence Collection

---

### 5.2 Audit Context Contract

All plugins receive a shared, typed context:

```ts
interface AuditContext {
  run_id: string;
  url: string;
  page: Page;
  results: Partial<AuditResults>;
  artifacts: ArtifactCollector;
  log: Logger;
  flags: {
    hasErrors: boolean;
  };
}
```

Plugins **must not**:

- Mutate global state
- Assume execution order beyond context
- Directly write to the database

---

### 5.3 Plugin Interface

```ts
interface AuditPlugin {
  name: string;
  requires?: ("dom" | "network" | "interaction")[];
  run(ctx: AuditContext): Promise<void>;
}
```

This enables:

- Safe extensibility
- Conditional execution
- Future parallelization

---

## **6. Browser & Performance Strategy**

### 6.1 Browser Lifecycle

Audit workers:

- Launch **one browser instance**
- Reuse browser contexts per batch or domain
- Create one page per URL

Discovery workers:

- Block images, fonts, CSS
- Never execute heavy scripts

---

### 6.2 Evidence Collection Rules

Artifacts are created **only when necessary**:

| Artifact     | Trigger                            |
| ------------ | ---------------------------------- |
| Screenshot   | Violations exceed threshold        |
| Trace (.zip) | Plugin error or navigation failure |

---

## **7. Logging & Observability**

### 7.1 NDJSON Logging Standard

- One JSON object per line
- Streamable
- CLI- and agent-friendly

---

### 7.2 Event Taxonomy

All logs include a standardized `event` field:

```json
{
  "event": "plugin_error",
  "plugin": "axe",
  "url": "...",
  "severity": "error",
  "artifact": "trace.zip"
}
```

This enables:

- Automated filtering
- Failure summarization
- Agent decision-making

---

## **8. Testing Strategy**

### 8.1 Fixture-Based Validation

- Audits are tested against static HTML fixtures
- Each fixture contains intentional failures
- No external network dependencies

Example fixtures:

- `broken-structure.html`
- `missing-labels.html`
- `color-contrast-fail.html`

---

## **9. Project Structure**

```text
/awa-root
├── /data                # SQLite DB + NDJSON logs
├── /artifacts           # Screenshots + Trace archives
├── /src
│   ├── /core            # Orchestrator, worker lifecycle
│   ├── /plugins         # Audit plugins
│   ├── /db              # Schema, queries, migrations
│   ├── /logging         # Logger configuration
│   └── /types           # Shared contracts
├── /tests
│   └── /fixtures
└── package.json
```

---

## **10. Agent-First Design Principles**

- CLI supports `--format json`
- All outputs are machine-readable
- Logs and DB state fully describe system behavior
- No hidden state or in-memory-only decisions

---

## **Non-Goals**

- No SaaS backend
- No cloud dependency
- No real-time UI requirements
- No mandatory external services
