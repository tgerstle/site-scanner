# Phase 1 Spec: Configurable Concurrency

## Status: Not Started

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

## 3. Success Criteria & Tests
- [ ] Running `awa start --url <URL> --concurrency 1` results in exactly 1 `audit` worker being spawned.
- [ ] Running `awa start --url <URL> --concurrency 4` results in exactly 4 `audit` workers being spawned.
- [ ] Config provided in `awaconfig.json` is respected if first-class CLI flag is absent.

### Automated Test Idea (Integration)
Create a test in [packages/core/src/orchestrator.test.ts](packages/core/src/orchestrator.test.ts) that verifies `spawnWorker` is called $N$ times based on a config object.
