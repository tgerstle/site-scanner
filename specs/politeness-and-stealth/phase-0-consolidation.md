# Phase 0 Spec: Worker Consolidation & Dead-Code Removal

## Status: Done

## 1. Goal
Before adding concurrency, throttling, and stealth, collapse the dual worker model down to the single consolidated `audit` worker that the `start` path and web GUI already use. This removes dead/divergent code so the later phases refactor one path instead of two.

## 2. Background
- `start` ([packages/cli/src/index.ts:185-186](packages/cli/src/index.ts#L185-L186)) and the web trigger ([apps/web/src/pages/api/trigger.ts](apps/web/src/pages/api/trigger.ts)) spawn **only `audit`-role workers**, which discover links inline ([audit-worker.ts:209-250](packages/core/src/audit-worker.ts#L209-L250)) and audit in the same pass.
- The `discovery` role is reachable **only** through the manual `resume` command ([index.ts:286](packages/cli/src/index.ts#L286)); the web app never calls `resume` (pause/continue signal the process directly). It is dead in every automated/GUI path.

## 3. Changes

### 3a. Migrate `resume` to the consolidated worker
`resume` spawns `config.concurrency` `audit` workers (reading stored config per Phase 1 / Guiding Principle #3), instead of 1 `discovery` + 1 `audit`. This keeps `resume` working while dropping its dependence on the discovery role.

### 3b. Delete the discovery role
- Remove `DiscoveryWorker` — [packages/core/src/discovery-worker.ts](packages/core/src/discovery-worker.ts) (whole file).
- Remove the `role === "discovery"` branch in [packages/core/src/worker.ts:41-43](packages/core/src/worker.ts#L41-L43).
- **Keep `discoverLinks()`** — [packages/core/src/discovery.ts:56](packages/core/src/discovery.ts#L56). Rather than delete it (its only caller was `DiscoveryWorker`), **de-duplicate**: the audit worker's inline `page.$$eval("a", …)` extraction ([audit-worker.ts:215](packages/core/src/audit-worker.ts#L215)) should call `discoverLinks(page)` for the raw extraction, then keep its own normalize/filter/triage/insert. This removes the duplicated anchor-extraction logic and keeps `discoverLinks` a tested primitive. (Adjust `discoverLinks` to accept a `Page` instead of opening its own page, since the audit worker already has the loaded page.)
- Keep `setupFastContext()` and `filterLinks()` in `discovery.ts` — still used by the CLI `classify` command and the audit worker's inline discovery respectively. (In Phase 3, `setupFastContext` becomes a thin wrapper over `createStandardContext`.)
- **Drop the `"discovery"` value from `WorkerRole`** ([packages/types/src/db.ts:1](packages/types/src/db.ts#L1)): `WorkerRole = "audit"`. Downstream effects:
  - [packages/db/src/queue.ts:65-66](packages/db/src/queue.ts#L65-L66) — the `role === "discovery"` branch is already a no-op (`fromStatus` is `"pending"` either way). Simplify `claimNextJob` to always claim `pending → processing`; the `role` param can stay for signature stability but the discovery branch goes.
  - **Keep the `processing_discovery` *queue status*** ([db.ts:6](packages/types/src/db.ts#L6)) and its references in `run.ts`, CLI, and the web `pause`/`continue`/`queries` SQL. That value is a historical/queue state distinct from the worker role; leaving it in the `IN (...)` clauses is harmless backward-compat for old rows. Only the *role* enum value is removed.
  - Update tests that call `claimNextJob(db, worker, "discovery")` ([queue.test.ts:29-30](packages/db/src/queue.test.ts#L29-L30), [heartbeats.test.ts:37](packages/db/src/heartbeats.test.ts#L37)) and `spawnWorker("discovery", ...)` ([orchestrator.test.ts:42,65](packages/core/src/orchestrator.test.ts#L42)) to use `"audit"`.

### 3c. Incidental dead code (bundle into this cleanup)
- Remove unused export `generateExportDatasets()` — [packages/core/src/normalization.ts:196](packages/core/src/normalization.ts#L196) (zero callers).
- Remove unused import `normalizeUrl` — [packages/cli/src/index.ts:4](packages/cli/src/index.ts#L4).
- Remove unused dependency `zod` from `packages/cli/package.json`.

### 3d. De-duplicate triage fallback (optional, low-risk)
The `twoTrackEnabled ? triageResource(url) : { resourceType:"unknown", auditDisposition:"deferred", skipReason:null }` ternary is copy-pasted at [cli/index.ts:109](packages/cli/src/index.ts#L109), :142, and (pre-deletion) `discovery-worker.ts:66`. After 3b only the two CLI copies remain — extract a small `triageOrDefault(url, twoTrackEnabled)` helper.

## 4. Success Criteria & Tests
- [ ] `awa start` and `awa resume` both run to completion using only `audit` workers; no `discovery` worker is ever spawned.
- [ ] `awa resume --run-id <id>` honors the stored `concurrency` (see Phase 1).
- [ ] `awa classify` still works (proves `setupFastContext` was not broken by the deletion).
- [ ] `pnpm build` + `pnpm test` pass with `discovery-worker.ts` removed.
- [ ] No remaining references to `DiscoveryWorker` or `discoverLinks` anywhere outside deleted files / historical tests.

### Test cleanup
- [packages/core/src/discovery-worker.test.ts](packages/core/src/discovery-worker.test.ts) references `setupFastContext`/`filterLinks`/`discoverLinks`. Update or remove the parts covering the deleted `DiscoveryWorker`/`discoverLinks`; keep coverage for `filterLinks` and `setupFastContext`.
