# Spec: Politeness and Stealth Strategies

## 1. Overview

The goal of this specification is to provide mechanisms to mitigate the load the scanner places on target sites and to improve the scanner's ability to operate on sites with aggressive bot detection.

Currently, the scanner has:

- Hardcoded concurrency (2 workers in CLI).
- Hardcoded inter-request delay (5 seconds in `WorkerLoop`).
- Fixed browser configurations that may be easily detectable as automation.

### Guiding Principles (apply to all phases)

1. **Auditing fidelity beats stealth.** The scanner's core job is accurate audits — Lighthouse / Core Web Vitals, axe accessibility, SEO. Any stealth or politeness measure that would degrade audit accuracy loses. Concretely: the audit lane MUST load page assets (CSS, images, fonts) because Lighthouse performance/CWV scoring and axe visual/contrast checks depend on a fully rendered page, and the audit browser MUST keep `--remote-debugging-port` so Lighthouse can attach over CDP. Asset blocking is a discovery-lane speed optimization only — it must never be forced onto the audit lane, and stealth must never remove the CDP port from the audit browser.
2. **One knob, everywhere.** Every user-facing setting introduced here (concurrency, throttle, stealth, proxy, user-agent, etc.) must be settable consistently in all three surfaces: the config file, the CLI flags ([packages/cli/src/index.ts](packages/cli/src/index.ts)), and the web GUI trigger ([apps/web/src/pages/api/trigger.ts](apps/web/src/pages/api/trigger.ts)). A flag that exists in one surface but not the others is a bug. All settings flow through the Zod schema via `loadConfig` — never post-hoc `(config as any)` mutation.
3. **Resume inherits the run's conditions.** `resume` must reload the stored `ScannerConfig` for the run and honor the same concurrency, throttle, and stealth settings the run was originally started (or paused) under — not a fixed default topology.

### Phase Ordering

0. **[Phase 0 — Consolidation & dead-code removal](phase-0-consolidation.md)** (do first): collapse to the single consolidated `audit` worker, delete the dead `discovery` role, migrate `resume`. This is a prerequisite so Phases 1–3 refactor one worker path, not two.
1. **[Phase 1 — Concurrency](phase-1-concurrency.md)**
2. **[Phase 2 — Throttling & jitter](phase-2-throttling.md)**
3. **[Phase 3 — Stealth & anti-detection](phase-3-stealth.md)**
4. **[Phase 4 — Test coverage tooling](phase-4-coverage.md)** (do last): measure baseline against final code and gate on a ratcheting threshold.

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

2. **Stealth Mode (no third-party plugin)**:
   - Third-party JS stealth plugins were evaluated and rejected: `playwright-extra-plugin-stealth` is a placeholder package (single `0.0.1` release from 2022), and the real equivalent, `puppeteer-extra-plugin-stealth` (used via `playwright-extra`'s shim), has been unmaintained since 2023 — three years behind current bot-detection techniques.
   - Instead, use a multi-layered native strategy (detailed in Phase 3):
     - **Native context config**: realistic `userAgent`, `viewport`, `locale`, `timezoneId`, `deviceScaleFactor` passed directly to `browser.newContext()`.
     - **Launch flags**: `--disable-blink-features=AutomationControlled` to mask `navigator.webdriver` and related CDP-visible signals (avoid `--no-sandbox` unless the runtime environment requires it — it's a security tradeoff, not a stealth win).
     - **Minimized CDP probing**: batch `page.evaluate()` calls rather than polling repeatedly, since call frequency/pattern on the CDP `Runtime.evaluate` domain is itself a fingerprinting signal.
     - **Behavioral realism** (opt-in via `humanize`): randomized 500–1500ms delays between interactions instead of instant/uniform timing; curved-path mouse movement is noted as future work given the scanner's interactions are mostly navigation/read rather than form-filling.
   - This still targets the same detection surface (`navigator.webdriver` and other signatures Cloudflare/Akamai-style anti-bot services check) but keeps pace with whatever Playwright/Chromium version the repo pins, rather than depending on a stale plugin.

3. **Proxy Support**:
   - Add `proxy: { server: string, username?: string, password?: string }` to `ScannerConfig`.
   - Allows rotating IPs or using a clean residential proxy to avoid geographic or reputation-based blocks.
   - **Verified**: on the pinned Playwright (`playwright-core@1.60.0`, core pins `^1.58.2`), per-context `proxy` passed to `newContext()` is fully supported; the historical "browser must be launched with a global proxy first" caveat no longer applies. Set proxy on the context, not the launch.

4. **Header Management**:
   - Ensure common headers like `Accept-Language`, `Referer`, and `Sec-CH-UA` are set reasonably.

5. **Resource Blocking (per-lane, NOT a stealth toggle)**:
   - The current `setupFastContext` ([packages/core/src/discovery.ts](packages/core/src/discovery.ts#L11)) blocks images, CSS, fonts, and video for crawl speed. This is a **discovery-lane** optimization.
   - Per Guiding Principle #1, the **audit lane always loads assets** — Lighthouse/CWV and axe require a rendered page, and this is not negotiable for stealth. `blockAssets` therefore governs the discovery lane only; the audit lane ignores it (effectively always `false`).
   - The concern that "bot detectors flag clients that never request assets" is real but is resolved for the audit lane automatically (it loads assets). We do NOT tie `blockAssets` to `stealth`; assets are loaded because the audit requires them, not as a stealth heuristic.

## 5. Architectural Impact Analysis

### File Changes:

- [packages/types/src/cascading/config.ts](packages/types/src/cascading/config.ts): Update Zod schema for `ScannerConfig`.
- [packages/core/src/worker-base.ts](packages/core/src/worker-base.ts): Update `WorkerLoop` to use dynamic delay.
- [packages/core/src/audit-worker.ts](packages/core/src/audit-worker.ts): Pass throttle/stealth settings to the consolidated audit worker. (`discovery-worker.ts` is being deleted in Phase 0 — see below.)
- [packages/cli/src/index.ts](packages/cli/src/index.ts): Add CLI flags (`start` **and** `resume`) and pass through `loadConfig`.
- [apps/web/src/pages/api/trigger.ts](apps/web/src/pages/api/trigger.ts): Forward the new options as CLI args so the GUI mirrors config + CLI (Guiding Principle #2). Today it only forwards `-l/-u/-d/-p/--network-timeout/--two-track/--audit-documents`.

### Potential Issues:

- **Resilience**: If `throttleMs` is very high, worker heartbeats must still be sent frequently enough ([packages/core/src/worker-base.ts](packages/core/src/worker-base.ts#L10)) to avoid being marked as "zombies" by the `Orchestrator`.
- **Complexity**: Multiple places determine browser context creation (`DiscoveryWorker`, `AuditWorker`). These should be unified to ensure stealth settings are applied consistently.
