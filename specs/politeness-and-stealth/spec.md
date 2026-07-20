# Spec: Politeness and Stealth Strategies

## 1. Overview

The goal of this specification is to provide mechanisms to mitigate the load the scanner places on target sites and to improve the scanner's ability to operate on sites with aggressive bot detection.

Currently, the scanner has:

- Hardcoded concurrency (2 workers in CLI).
- Hardcoded inter-request delay (5 seconds in `WorkerLoop`).
- Fixed browser configurations that may be easily detectable as automation.

## 2. Configurable Concurrency

Concurrency refers to the number of parallel workers (processes) performing tasks (discovery or auditing) against a site.

### Proposed Changes:

- **`ScannerConfig`**: Add a `concurrency: number` property (default: 2).
- **CLI**: Add a `--concurrency` (alias `-j`) flag to the `start` and `resume` commands.
- **`Orchestrator`**: Ensure the orchestrator is spawned with the correct worker count.
- **Implementation Detail**:
  - In [packages/cli/src/index.ts](packages/cli/src/index.ts), replace the hardcoded "spawn 2 workers" logic with a loop based on the `concurrency` config.

### Side Effects:

- **Database Load**: More workers increase simultaneous connections to `awa.sqlite`. `better-sqlite3` handles this with WAL mode, but high concurrency might cause "database is locked" errors if not handled.
- **Target Site Load**: Lowering concurrency is the most effective way to prevent "taking down" a site.

## 3. Configurable Throttling (Inter-request Delay)

"Throttling" in this context refers to the pause between the completion of one job and the start of the next within a single worker.

### Proposed Changes:

- **`ScannerConfig`**: Add `throttleMs: number` (default: 5000).
- **`WorkerLoop`**:
  - Modify the constructor to accept a `delayMs` parameter or the full config.
  - Update the `setTimeout` in the `poll()` method to use this value.
- **Randomized Jitter**: Introduce an optional `throttleJitter: number` (percentage) to vary the delay (e.g., 5000ms +/- 10%). This makes the scraper look less like a robot.

### Side Effects:

- **Total Run Duration**: Increasing the delay significantly increases the time to audit large sites.
- **Resource Usage**: Workers remain alive longer but spend more time idle.

## 4. Stealth and Anti-Detection

Scraping difficult sites requires mimicking human behavior and avoiding common automation footprints.

### Strategies:

1. **Custom User-Agent**:
   - Add `userAgent: string` to `ScannerConfig`.
   - Allow users to set a realistic browser string or a clear "Adaptive Web Auditor/1.0 (Bot)" string.
   - Pass this to Playwright's `newContext({ userAgent })`.

2. **Stealth Mode**:
   - Integrate `playwright-extra` and `playwright-extra-plugin-stealth`.
   - This hides properties like `navigator.webdriver` and other signatures that many "anti-bot" services (like Cloudflare or Akamai) check.

3. **Proxy Support**:
   - Add `proxy: { server: string, username?: string, password?: string }` to `ScannerConfig`.
   - Allows rotating IPs or using a clean residential proxy to avoid geographic or reputation-based blocks.

4. **Header Management**:
   - Ensure common headers like `Accept-Language`, `Referer`, and `Sec-CH-UA` are set reasonably.

5. **Resource Blocking Toggles**:
   - The current `setupFastContext` ([packages/core/src/discovery.ts](packages/core/src/discovery.ts#L11)) blocks images, CSS, and fonts. While efficient, some bot detectors mark clients as suspicious if they never request assets. We should make this configurable.

## 5. Architectural Impact Analysis

### File Changes:

- [packages/types/src/cascading/config.ts](packages/types/src/cascading/config.ts): Update Zod schema for `ScannerConfig`.
- [packages/core/src/worker-base.ts](packages/core/src/worker-base.ts): Update `WorkerLoop` to use dynamic delay.
- [packages/core/src/audit-worker.ts](packages/core/src/audit-worker.ts) & [packages/core/src/discovery-worker.ts](packages/core/src/discovery-worker.ts): Pass throttle/stealth settings to individual workers.
- [packages/cli/src/index.ts](packages/cli/src/index.ts): Add CLI flags and pass to `Orchestrator`.

### Potential Issues:

- **Resilience**: If `throttleMs` is very high, worker heartbeats must still be sent frequently enough ([packages/core/src/worker-base.ts](packages/core/src/worker-base.ts#L10)) to avoid being marked as "zombies" by the `Orchestrator`.
- **Complexity**: Multiple places determine browser context creation (`DiscoveryWorker`, `AuditWorker`). These should be unified to ensure stealth settings are applied consistently.
