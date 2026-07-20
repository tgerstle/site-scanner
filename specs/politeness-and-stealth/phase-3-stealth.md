# Phase 3 Spec: Stealth & Anti-Detection

## Status: Not Started

## 1. Goal
Improve the scanner's ability to avoid detection by automated bot-defense systems by mimicking human browser signatures and allowing proxy usage.

## 2. Proposed Changes

### [packages/types/src/cascading/config.ts](packages/types/src/cascading/config.ts)
```typescript
export const ScannerConfigSchema = z.object({
    // ...
    stealth: z.boolean().default(false),
    userAgent: z.string().optional(),
    proxy: z.object({
        server: z.string(),
        username: z.string().optional(),
        password: z.string().optional(),
    }).optional(),
    blockAssets: z.boolean().default(true), // Allow turning off asset blocking
});
```

### [packages/core/src/audit-worker.ts](packages/core/src/audit-worker.ts) & [packages/core/src/discovery.ts](packages/core/src/discovery.ts)
Refactor browser context creation to a shared utility or helper.

```typescript
export async function createStandardContext(browser: Browser, config: ScannerConfig) {
  const contextOptions: BrowserContextOptions = {
    userAgent: config.userAgent,
    proxy: config.proxy,
  };

  // If stealth is enabled, use playwright-extra (requires implementation change)
  const context = await browser.newContext(contextOptions);

  if (config.blockAssets) {
    await context.route("**/*.{png,jpg,jpeg,gif,svg,css,woff,woff2}", (route) => route.abort());
  }
}
```

## 3. Implementation Details
- **Dependency**: Add `playwright-extra` and `playwright-extra-plugin-stealth` to `packages/core`.
- **Worker Refactor**: Both `AuditWorker` and `DiscoveryWorker` should use the same initialization logic to ensure consistent behavior.

## 4. Success Criteria & Tests
- [ ] **Stealth Check**: Use a site like `https://bot.sannysoft.com/` to verify that `navigator.webdriver` is hidden when `stealth: true`.
- [ ] **UA Check**: Verify the target site receives the `userAgent` string set in config.
- [ ] **Asset Check**: Verify images load/don't load based on `blockAssets`.

### Automated Test
Create a test that spawns a worker and inspects the network headers sent by the crawler.
