# Phase 2 Spec: Configurable Throttling & Jitter

## Status: Not Started

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
export class WorkerLoop {
  protected config: ScannerConfig; // Add config to constructor

  private async poll() {
    try {
      await this.processJob();
    } catch (e) { /* ... */ }

    const baseDelay = this.config.throttleMs ?? 5000;
    const jitterFactor = (this.config.throttleJitter ?? 0) / 100;
    const jitter = baseDelay * jitterFactor * (Math.random() * 2 - 1); // +/- range
    const finalDelay = Math.max(0, baseDelay + jitter);

    setTimeout(() => this.poll(), finalDelay);
  }
}
```

## 3. Implementation Details
- **Heartbeat Safety**: The `heartbeatTimer` is already separate (`setInterval`), so it will continue to fire every 30s even if `throttleMs` is 60s. This is correct.
- **Worker Updates**: `DiscoveryWorker` and `AuditWorker` subclasses need to pass the `config` through to `super()`.

## 4. Success Criteria & Tests
- [ ] Setting `throttleMs: 0` results in immediate job processing (useful for local dev/testing).
- [ ] Setting `throttleMs: 10000` shows logs with ~10s gaps between job completions.
- [ ] Multiple workers each have unique jittered timings (verified via logs).

### Manual Verification
1. Run scan with `DEBUG=worker_log`.
2. Observe timestamps of "Job claimed" events.
