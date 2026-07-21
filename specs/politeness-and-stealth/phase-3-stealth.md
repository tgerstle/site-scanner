# Phase 3 Spec: Stealth & Anti-Detection

## Status: Done

## 1. Goal
Improve the scanner's ability to avoid detection by automated bot-defense systems by mimicking human browser signatures and allowing proxy usage.

> **Precedence (see Guiding Principle #1 in [spec.md](spec.md)):** auditing fidelity beats stealth. The audit lane MUST keep `--remote-debugging-port` (Lighthouse attaches over CDP) and MUST load page assets (Lighthouse/CWV + axe need a rendered page). Nothing in this phase may compromise those two invariants. Where a stealth measure conflicts with audit accuracy, the audit wins.

## Revision Note
The original draft of this phase proposed `playwright-extra` + a stealth plugin. That approach is dropped: the named package (`playwright-extra-plugin-stealth`) turned out to be an unmaintained placeholder, and even the correct plugin (`puppeteer-extra-plugin-stealth`) hasn't been updated since 2023 — three years behind current bot-detection techniques. Instead, this phase uses a multi-layered strategy built on Playwright's own APIs and launch flags, plus behavioral realism, with no third-party stealth dependency.

## 2. Proposed Changes

### [packages/types/src/cascading/config.ts](packages/types/src/cascading/config.ts)
```typescript
const DEFAULT_DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export const ScannerConfigSchema = z.object({
    // ...
    stealth: z.boolean().default(false),
    // NOTE: default a realistic desktop UA, do NOT leave undefined. Passing undefined to
    // newContext() makes Playwright emit a UA containing "HeadlessChrome" — the single most
    // obvious automation tell, which would make stealth mode ineffective out of the box.
    userAgent: z.string().default(DEFAULT_DESKTOP_UA),
    // Single source of truth for viewport: give the whole object a default so it is never
    // undefined, and drop the runtime `?? {1920x1080}` fallback in the code (see §2d note).
    viewport: z.object({
        width: z.number().default(1920),
        height: z.number().default(1080),
    }).default({ width: 1920, height: 1080 }),
    locale: z.string().default("en-US"),
    timezoneId: z.string().optional(), // e.g. "America/New_York"
    proxy: z.object({
        server: z.string(),
        username: z.string().optional(),
        password: z.string().optional(),
    }).optional(),
    // Discovery-lane speed optimization ONLY. The audit lane always loads assets
    // (Lighthouse/CWV + axe require a rendered page) and ignores this flag. Not tied to stealth.
    blockAssets: z.boolean().default(true),
    /**
     * When stealth is enabled, adds randomized delays and (future) mouse-movement
     * simulation before interacting with elements. See §2c.
     */
    humanize: z.boolean().default(false),
});
```

> **Why a UA default and not `.optional()`:** the original draft left `userAgent` optional with only a code comment saying "realistic UA if not set." Nothing set it, so stealth still shipped `HeadlessChrome`. A schema-level default guarantees a real UA whenever stealth is on. A user who genuinely wants the bot-honest string (`Adaptive Web Auditor/1.0 (Bot)`) sets it explicitly.

### 2a. Native Context Configuration
Always configure Playwright's native `browser.newContext()` options to mimic a real desktop browser — this is the first and most load-bearing layer, independent of any stealth flag. This snippet is illustrative; the single canonical implementation lives in `createStandardContext` (§2d) — do not hand-roll a second copy with a different option set.

```typescript
const context = await browser.newContext({
  userAgent: config.userAgent,       // schema-defaulted realistic desktop UA (never undefined)
  viewport: config.viewport,          // schema-defaulted; no runtime `??` fallback needed
  deviceScaleFactor: 1,
  locale: config.locale,
  timezoneId: config.timezoneId,
  proxy: config.proxy,                // per-context proxy — verified supported on pinned Playwright
});
```
- **`permissions: ["geolocation"]` removed.** The original draft granted geolocation but never set coordinates, which is both pointless and a mild fingerprint (a real browser that granted geolocation would return a position). Omit it. Keep the option set identical between §2a and §2d — the earlier draft's two snippets disagreed (one had `permissions`/`deviceScaleFactor`, the other didn't); §2d is authoritative.

### 2b. Launch Flags — and the non-negotiable CDP port
When `config.stealth` is true, add flags that mask the most common automation signals. **Critical:** the audit browser must still expose `--remote-debugging-port=<cdpPort>` — the Lighthouse plugin attaches over CDP using the port threaded through `auditCtx.cdpPort` ([audit-worker.ts:335](packages/core/src/audit-worker.ts#L335)). A stealth launcher that omits it silently breaks all Lighthouse/CWV audits. The launcher therefore **takes the cdpPort as an argument**:

```typescript
export async function launchAuditBrowser(cdpPort: number, config: ScannerConfig): Promise<Browser> {
  const args = [
    `--remote-debugging-port=${cdpPort}`, // REQUIRED for Lighthouse — never drop this
    "--disable-gpu",
    "--disable-dev-shm-usage",
  ];
  if (config.stealth) {
    args.push("--disable-blink-features=AutomationControlled");
    // NOT --no-sandbox by default: only add if the container requires it (Docker without
    // --cap-add=SYS_ADMIN). Dropping the sandbox is a security tradeoff, not a stealth win.
  }
  return chromium.launch({ headless: true, args });
}
```
- `--disable-blink-features=AutomationControlled` is the standard mitigation for `navigator.webdriver` and related CDP-visible flags; no third-party plugin needed.
- This replaces the argument-less `launchStealthBrowser()` from the earlier draft, which omitted the debugging port and would have broken the audit lane.

### 2c. Minimize CDP-Visible Probing
- Avoid repeated `page.evaluate()` calls for polling/probing — each round-trips through the CDP `Runtime.evaluate` domain, which some anti-bot heuristics fingerprint by call frequency/pattern. Where the scanner currently polls via `evaluate` (e.g. classifier or a11y checks), batch reads into a single evaluate call instead of many small ones.
- **Behavioral realism** (`config.humanize`): before interacting with elements, add non-linear delays instead of instant actions:
  ```typescript
  async function humanDelay(min = 500, max = 1500) {
    await new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));
  }
  ```
  Mouse-movement simulation (moving in curved paths rather than teleporting the cursor) is a further layer worth prototyping but is lower priority than the above — the scanner's current interactions are mostly navigation/read-only, not form-filling, so the payoff is smaller here than for a scraper mimicking rich user interaction. Flag as **future work**, not required for this phase's success criteria.

### 2d. Shared Context Builder
### [packages/core/src/discovery.ts](packages/core/src/discovery.ts) (shared home for the builder)
Refactor context creation into one utility so every lane applies the same identity settings. **Asset blocking is a per-lane argument, not a config-driven default** (Guiding Principle #1): the discovery lane may block for speed; the audit lane must never block (Lighthouse/CWV + axe need assets).

```typescript
// blockAssets is an explicit CALLER argument, decoupled from config.blockAssets,
// so the audit lane can force it false regardless of user config.
export async function createStandardContext(
  browser: Browser,
  config: ScannerConfig,
  blockAssets: boolean,
) {
  const context = await browser.newContext({
    userAgent: config.userAgent,   // schema-defaulted, never undefined
    viewport: config.viewport,      // schema-defaulted
    deviceScaleFactor: 1,
    locale: config.locale,
    timezoneId: config.timezoneId,
    proxy: config.proxy,
  });

  if (blockAssets) {
    // Keep the existing glob (includes mp4/webm) so discovery behavior is unchanged.
    await context.route(
      "**/*.{png,jpg,jpeg,gif,svg,css,woff,woff2,mp4,webm}",
      (route) => route.abort(),
    );
  }

  return { browser, context }; // same shape setupFastContext() returns — callers depend on it.
}
```

Lane wiring:
- **Discovery lane** (`setupFastContext` replacement / `DiscoveryWorker`): `createStandardContext(browser, config, config.blockAssets)` — honors the user's speed preference.
- **Audit lane** (`AuditWorker`): launch via `launchAuditBrowser(this.cdpPort, config)` (§2b), then `createStandardContext(browser, config, false)` — **always** loads assets, ignoring `config.blockAssets`.
- The old `setupFastContext()` in [discovery.ts](packages/core/src/discovery.ts#L4) is also used by the CLI `classify` command ([index.ts:655](packages/cli/src/index.ts#L655)); keep it as a thin wrapper (`createStandardContext(browser, config, true)`) or update that call site too, so nothing breaks.

## 3. Implementation Details
- **No third-party stealth dependency.** This phase intentionally avoids `playwright-extra` / `puppeteer-extra-plugin-stealth` given their multi-year staleness (see Revision Note). All mitigations are native Playwright options or launch flags, which stay in sync with whatever Playwright/Chromium version the repo pins (`playwright@^1.58.2`).
- **Worker topology (DECIDED: consolidated single worker).** The `start` path and the web GUI spawn **only `audit`-role workers**, which do link discovery *inline* ([audit-worker.ts:209-250](packages/core/src/audit-worker.ts#L209-L250)) as well as auditing. The separate `DiscoveryWorker` / `discovery` role is being **removed** (see Phase 0 cleanup below). **The sole target of this phase is the `AuditWorker` context/launch path.**
- **Worker Refactor**: `AuditWorker` launches via `launchAuditBrowser(this.cdpPort, config)` (§2b, preserves the CDP port) and builds its context via `createStandardContext(browser, config, /* blockAssets */ false)` — the audit lane never blocks assets. Since discovery now happens inside the audit worker, its inline link-extraction reuses the shared `filterLinks`/triage helpers but runs against the same asset-loaded context (no separate fast context).
- **CLI / Web wiring (Guiding Principle #2).** Add CLI flags mirroring config on `start` **and** `resume`: `--stealth`, `--user-agent <ua>`, `--proxy <server>` (+ optional `--proxy-user`/`--proxy-pass`), `--locale`, `--timezone`, `--no-block-assets`, `--humanize`. All flow through `loadConfig` overrides (never `(config as any)` mutation). `resume` reads these from the stored run config so a resumed run keeps its stealth posture. [apps/web/src/pages/api/trigger.ts](apps/web/src/pages/api/trigger.ts) forwards the same options as CLI args.
- **`humanize` is opt-in and orthogonal to `stealth`**: `stealth` affects browser/context setup (one-time cost per worker); `humanize` affects per-interaction timing (recurring cost per job) and directly trades off against `throttleMs`/Phase 2 — a team using both should account for the added delay when sizing run-duration expectations.

## 4. Success Criteria & Tests
- [ ] **Audit integrity (hard gate, highest priority):** with `stealth: true`, a Lighthouse/CWV audit still runs and returns performance metrics — i.e. the CDP port survived the stealth launch. This gate ranks above every stealth check below.
- [ ] **Audit assets always load:** with `stealth: true` AND `blockAssets: true`, the audit lane still requests CSS/images (verify the audit context does not register the abort route). Only the discovery lane honors `blockAssets`.
- [ ] **Stealth Check**: Use a site like `https://bot.sannysoft.com/` to verify that `navigator.webdriver` is hidden and other automation-only signals pass when `stealth: true`. Treat this as a hard gate (re-run periodically — detection sites change their checks over time) rather than a one-time smoke test.
- [ ] **No HeadlessChrome in UA:** default `userAgent` (when unset) contains no `HeadlessChrome` token.
- [ ] **UA/Viewport/Locale Check**: Verify the target site receives the `userAgent`, `viewport`, and `locale` set in config (e.g. via an echo endpoint or request-header inspection).
- [ ] **Asset Check**: Verify images load/don't load in the **discovery** lane based on `blockAssets`.
- [ ] **Humanize Check**: With `humanize: true`, verify inter-action delays fall in the 500–1500ms band (via timestamps in debug logs).
- [ ] **Config consistency:** the same stealth settings can be supplied via config file, CLI flag, and web trigger and produce identical launch args / context options.

### Automated Test
- Unit-test `launchAuditBrowser(port, config)`: asserts args always include `--remote-debugging-port=<port>`, and include `--disable-blink-features=AutomationControlled` iff `config.stealth`.
- Unit-test `createStandardContext(..., blockAssets)`: asserts the abort route is registered iff `blockAssets` is true, and that context options reflect config UA/viewport/locale/proxy.
- Integration test spawning a worker and inspecting the network headers / launch args sent by the crawler.
