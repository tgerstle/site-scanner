# Phase 1 Spec: Configurable Concurrency

## Status: Done

## 1. Goal
Decouple the number of parallel workers from hardcoded CLI logic and allow user control via configuration and CLI flags.

## 2. Proposed Changes

### [packages/types/src/cascading/config.ts](packages/types/src/cascading/config.ts)
Add `concurrency` to the `ScannerConfigSchema`.

```typescript
export const ScannerConfigSchema = z.object({
    // ... existing ...
    maxDepth: z.number().min(0).default(3),
    concurrency: z.number().min(1).default(2), // New property
    // ...
});
```

### [packages/cli/src/index.ts](packages/cli/src/index.ts)
Update the `start` and `resume` commands to accept `--concurrency` (alias `-j`).

```typescript
program
    .command("start")
    // ... existing options ...
    .option("-j, --concurrency <number>", "Number of parallel workers", "2")
    .action(async (options) => {
        const concurrency = parseInt(options.concurrency, 10);
        const config = loadConfig(options.config, {
            // ...
            concurrency: concurrency,
        });

        // ...
        const orchestrator = new Orchestrator(db);
        for (let i = 1; i <= config.concurrency; i++) {
            orchestrator.spawnWorker("audit", `${runId}_aud_${i}`);
        }
    });
```

### [packages/cli/src/index.ts](packages/cli/src/index.ts) — `resume` command
`resume` currently spawns a fixed topology (1 discovery + 1 audit worker, [index.ts:286-287](packages/cli/src/index.ts#L286)). Per Guiding Principle #3, `resume` must instead read the stored config for the run (`getRunConfig`) and spawn `config.concurrency` audit workers, matching the conditions the run was started/paused under:

```typescript
const runConfig = getRunConfig(db, options.runId);
const concurrency = runConfig.concurrency ?? 2;
for (let i = 1; i <= concurrency; i++) {
    orchestrator.spawnWorker("audit", `${options.runId}_aud_res_${i}`);
}
```

Note the consolidated-worker model: the `start` path spawns only `audit`-role workers that do discovery + audit inline. `resume` follows the same model rather than reviving the separate `discovery` role — this migration is specified in **[Phase 0](phase-0-consolidation.md)**, which also deletes `DiscoveryWorker`. Phase 0 must land before this phase.

### [apps/web/src/pages/api/trigger.ts](apps/web/src/pages/api/trigger.ts)
Add the concurrency value to the forwarded CLI args (`cliArgs.push("-j", String(concurrency))`) so the GUI mirrors config + CLI.

## 3. Implementation Notes

- **`spawnWorker` needs no signature change.** [`Orchestrator.spawnWorker(role, workerId)`](packages/core/src/orchestrator.ts#L30) forks [`worker.ts`](packages/core/src/worker.ts) with just `role` and `workerId`; the child re-derives `runId` from `workerId` (`parts.slice(0, 3).join('_')`, flagged in-code as brittle) and loads `ScannerConfig` from the DB via `getRunConfig`. So raising concurrency only requires looping the CLI's `spawnWorker` calls with distinct suffixes (e.g. `${runId}_aud_${i}`) — no config plumbing through `spawnWorker` itself is required.
- **Don't disturb the runId-parsing heuristic incidentally.** New worker IDs like `${runId}_aud_3`, `_aud_4`, etc. are safe under the current 3-component parse (the suffix isn't part of it), but this is fragile by construction. If touching `worker.ts` anyway, consider passing `runId` as an explicit fork argument instead of re-deriving it — a small, self-contained hardening, optional relative to what this phase strictly needs.

### Avoid double defaults
Do **not** set a Commander `.option(..., "2")` default string *and* rely on the schema default. Prefer leaving the CLI flag undefined when absent and letting `loadConfig` → `ScannerConfigSchema` apply the single source-of-truth default (`concurrency: z.number().min(1).default(2)`). Otherwise the CLI's `"2"` always wins and a config-file value is silently ignored (violates the 3rd success criterion).

## 4. Success Criteria & Tests
- [ ] Running `awa start --url <URL> --concurrency 1` results in exactly 1 `audit` worker being spawned.
- [ ] Running `awa start --url <URL> --concurrency 4` results in exactly 4 `audit` workers being spawned.
- [ ] Config provided in `awaconfig.json` is respected if first-class CLI flag is absent.
- [ ] `awa resume --run-id <id>` spawns `config.concurrency` audit workers (reads stored config, not a fixed 1+1).
- [ ] `concurrency: 0` or negative is rejected by the schema (`.min(1)`).
- [ ] Web GUI trigger with a concurrency value forwards `-j` to the CLI.

### Automated Test Idea (Integration)
Create a test in [packages/core/src/orchestrator.test.ts](packages/core/src/orchestrator.test.ts) that verifies `spawnWorker` is called $N$ times based on a config object.
