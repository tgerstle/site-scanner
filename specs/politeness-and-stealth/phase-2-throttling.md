# Phase 2 Spec: Configurable Throttling & Jitter

## Status: Done

## 1. Goal
Replace the hardcoded 5-second polling delay in workers with a configurable value, optionally adding randomness ("jitter") to mimic human behavior.

## 2. Proposed Changes

### [packages/types/src/cascading/config.ts](packages/types/src/cascading/config.ts)
```typescript
export const ScannerConfigSchema = z.object({
    // ...
    throttleMs: z.number().min(0).default(5000),
    throttleJitter: z.number().min(0).max(100).default(10), // Percentage jitter
    // ...
});
```

### [packages/core/src/worker-base.ts](packages/core/src/worker-base.ts)
Modify `WorkerLoop` to use the config.

```typescript
const IDLE_FLOOR_MS = 250; // minimum sleep when no job was claimed, regardless of throttleMs

export class WorkerLoop {
  protected role: WorkerRole;
  protected workerId: string;
  protected config?: ScannerConfig;
  protected heartbeatTimer?: NodeJS.Timeout;

  constructor(role: WorkerRole, workerId: string, config?: ScannerConfig) {
    this.role = role;
    this.workerId = workerId;
    this.config = config;
  }

  // processJob() must return whether it actually claimed/processed a job,
  // so the loop can apply the idle floor when the queue is empty.
  protected async processJob(): Promise<boolean> {
    return false; // implemented by subclass
  }

  private async poll() {
    let didWork = false;
    try {
      didWork = await this.processJob();
    } catch (e) { /* log ... */ }

    setTimeout(() => this.poll(), this.computeDelay(didWork));
  }

  // Extracted as a pure, testable method (no timers, no Date.now).
  protected computeDelay(didWork: boolean): number {
    if (!didWork) return IDLE_FLOOR_MS; // empty queue: cheap poll, ignore throttleMs
    const baseDelay = this.config?.throttleMs ?? 5000;
    const jitterFactor = (this.config?.throttleJitter ?? 0) / 100;
    const jitter = baseDelay * jitterFactor * (Math.random() * 2 - 1); // +/- range
    return Math.max(0, baseDelay + jitter);
  }
}
```

**Idle floor** — the politeness `throttleMs` only applies between *actual* page loads. When `claimNextJob` returns nothing, applying `throttleMs` (especially `throttleMs: 0`) would busy-spin the DB. `computeDelay(false)` returns a fixed small `IDLE_FLOOR_MS` so an empty queue polls cheaply while a busy worker still honors `throttleMs` exactly (including `0` for instant back-to-back processing).

**Constructor collision (must fix, else it won't compile).** The base cannot declare `config` via a `protected config?` **parameter property** because both subclasses already declare their own `private config: ScannerConfig` field ([audit-worker.ts:19](packages/core/src/audit-worker.ts#L19), [discovery-worker.ts:13](packages/core/src/discovery-worker.ts#L13)). A parameter property would redeclare `config` with a narrower visibility than the subclass expects and fail typechecking. Fix: declare `protected config?` as a plain field on the base (as above) and **remove** the `private config` field from each subclass, changing their `super("audit", workerId)` calls to `super("audit", workerId, config)`. The subclasses then read `this.config` inherited from the base. `processJob` signatures in both subclasses must change to return `boolean`.

## 3. Implementation Details
- **Heartbeat Safety**: The `heartbeatTimer` is already separate (`setInterval`), so it will continue to fire every 30s even if `throttleMs` is 60s. This is correct.
- **Worker Updates**: `DiscoveryWorker` and `AuditWorker` subclasses already receive `config` as a constructor argument (from [`worker.ts`](packages/core/src/worker.ts), which loads it via `getRunConfig`) — they just store it privately today and call `super(role, workerId)` without forwarding it. The fix is to add an optional third param to `WorkerLoop`'s constructor:
  ```typescript
  constructor(role: WorkerRole, workerId: string, protected config?: ScannerConfig) { ... }
  ```
  and change each subclass's `super(...)` call to pass its existing `config` through. This is a same-file, mechanical change — no new data-fetching is needed since config is already available at construction time in both subclasses.

### CLI / Web / Resume wiring (Guiding Principle #2 & #3)
- CLI `start` and `resume`: add `--throttle <ms>` and `--jitter <percent>` flags, passed through `loadConfig` overrides (not post-hoc mutation).
- `resume` reads `throttleMs`/`throttleJitter` from the stored run config so it resumes under the same politeness settings.
- [apps/web/src/pages/api/trigger.ts](apps/web/src/pages/api/trigger.ts): forward `--throttle`/`--jitter` when provided.

## 4. Success Criteria & Tests
- [ ] Setting `throttleMs: 0` results in immediate job processing when jobs are queued (useful for local dev/testing).
- [ ] With `throttleMs: 0` and an **empty** queue, the worker polls at the idle floor (~250ms), not in a hot loop (verify CPU stays low / DB query rate is bounded).
- [ ] Setting `throttleMs: 10000` shows logs with ~10s gaps between job completions.
- [ ] Multiple workers each have unique jittered timings (verified via logs).
- [ ] **Unit test** `computeDelay(true)` stays within `baseDelay ± jitter%` and is never negative; `computeDelay(false)` returns exactly `IDLE_FLOOR_MS` regardless of `throttleMs`. (Extract `computeDelay` so it's testable without timers.)
- [ ] Both subclasses compile after removing their `private config` field and forwarding `config` to `super(...)`.

### Manual Verification
1. Run scan with `DEBUG=worker_log`.
2. Observe timestamps of "Job claimed" events.
