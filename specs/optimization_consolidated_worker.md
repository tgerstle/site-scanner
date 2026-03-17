# Optimization: Consolidated Worker Architecture

**Goal:** Improve scanning performance by 50-60% by eliminating redundant page loads.

**Current State:**
A "Cascading" pipeline where:

1. `DiscoveryWorker` loads page (Light) -> Extracts Links -> Status: `pending_audit`
2. `AuditWorker` loads page (Heavy) -> Classifies -> Runs Plugins -> Status: `completed`

**Problem:**
Every URL is visited twice. For a 1,000 page scan, this means 2,000 browser navigations. The "Light" mode of the discovery worker is not fast enough to justify the overhead of a second "Heavy" launch, especially since `AuditWorker` already needs to load the full DOM for classification.

## Proposed Solution: The "Universal" Worker

Merge both roles into a single worker that performs discovery and auditing in a single pass.

### 1. Workflow Changes

**Old Flow:**
`pending` -> `DiscoveryWorker` -> `pending_audit` -> `AuditWorker` -> `completed`

**New Flow:**
`pending` -> `UniversalWorker` -> `completed`

### 2. Logic Step-by-Step

The new `UniversalWorker` (or updated `AuditWorker`) will verify:

1.  **Claim Job**:
    - Select next `pending` job from `queue`.
    - Update status to `processing`.

2.  **Navigation & Wait**:
    - Launch/Reuse Browser Context (Full "Heavy" Mode).
    - Navigate to URL.
    - **Optimization**: Use `domcontentloaded` for speed.
    - **Fallback**: If classification is ambiguous, wait for `networkidle`.
    - _Outcome_: A fully loaded `Page` object.

3.  **Classification**:
    - Run `PageClassifier` on the live page.
    - Determine types (e.g., `["Product", "global"]`).

4.  **Discovery (Link Extraction)**:
    - **Check**: Is `current_depth < max_depth`?
    - **Action**: Extract all `<a>` hrefs.
    - **Filter**: Apply generic `include/exclude` patterns.
    - **Persist**: Insert new URLs into `queue` with status `pending`.
    - _Critical Safety_: Perform this **BEFORE** running plugins. If a plugin crashes the browser (e.g., OOM), we ensure the crawl frontier is saved so the scan doesn't stall.

5.  **Plugin Execution**:
    - Resolve plugins based on classification (e.g., Run `Lighthouse` only on "Product" pages).
    - Execute plugins sequentially.
    - Accumulate results.

6.  **Finalize**:
    - Save all audit results (violations, scores, metadata) to `results` table.
    - Mark job `completed`.

### 3. Database Schema Impacts

- **Queue Schema**: No structural changes needed.
- **Queue Statuses**:
  - Keep: `pending`, `completed`, `failed`, `stopped`.
  - Add: `processing` (Generic).
  - Deprecate/Remove: `processing_discovery`, `pending_audit`, `processing_audit`.
- **Migration**: Existing jobs in `pending_audit` from previous runs should be treated as `pending` or effectively ignored/reset if we wipe the queue.

### 4. Code Refactoring Plan

**Phase A: Worker Modification**

- Modify `packages/core/src/audit-worker.ts`:
  - Rename/Update to process `pending` jobs directly.
  - Integrate `discoverLinks` logic (already imported but conditional) to run _always_ if depth permits.
  - Ensure `insertJob` happens _before_ `runPipeline`.

**Phase B: Orchestrator Update**

- Update `packages/core/src/orchestrator.ts`:
  - Remove `spawnWorker('discovery')`.
  - Spawn `spawnWorker('audit')` (or 'universal').

**Phase C: Cleanup**

- Delete `packages/core/src/discovery-worker.ts`.
- Remove `discovery` role from `types` (or keep for backward compat for a bit).

### 5. Risk Mitigation

1.  **Lighthouse Interference**:
    - Lighthouse cleans up the page status, but we extract links _before_ it runs, so the page state (dirty or not) doesn't matter for discovery.
    - _Correction_: Actual Lighthouse run usually requires a fresh page or reloads it. Since we extract links _first_, we don't care if Lighthouse reloads the page after.

2.  **Crawl Traps**:
    - With "Heavy" rendering for every page, "Calendar" widgets or infinite URL spaces become much more expensive to process.
    - _Mitigation_: Ensure `excludePaths` is strictly enforced in the new worker.

3.  **Resilience**:
    - If `audit` (plugins) fails, we still want to save the discovered links.
    - Wrap the Plugin execution in a `try/catch` block that is separate from the Discovery `try/catch`.

### 6. Performance Expectations

| Metric                     | Old Architecture                 | New Architecture   |
| :------------------------- | :------------------------------- | :----------------- |
| Navigations / URL          | 2 (Discovery + Audit)            | 1 (Consolidated)   |
| DB Writes / URL            | 5 (Status updates)               | 3 (Status updates) |
| Context Switches           | High (Process -> IPV -> Process) | Low                |
| Estimated Time / 100 Pages | ~300s                            | ~150s              |
