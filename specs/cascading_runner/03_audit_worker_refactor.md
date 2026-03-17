# Phase 3: Audit Worker Logic

**Goal:** Refactor the `AuditWorker` to use the Classifier and dynamically execute plugins.

**Status:** Completed

## Outcomes

- [x] Integrate `PageClassifier` into `AuditWorker`
- [x] Implement dynamic plugin resolution based on classification
- [x] Implement Link Extraction within Audit Worker (Single-pass optimization)
- [x] Implement Redirect Handling and `redirect_chain` logging
- [x] Enhance Zombie Process Prevention (Strict Timeouts)

## 1. Refactoring `processJob`

The `AuditWorker` currently executes a static list of plugins. We need to split this into phases.

### New Workflow

1.  **Navigation:** `page.goto(url)` (Existing)
2.  **Classification:**
    ```typescript
    const classifier = new PageClassifier(this.config);
    const pageTypes = await classifier.classify(url, page);
    console.log(`Identified ${url} as [${pageTypes.join(", ")}]`);
    ```
3.  **Plugin Resolution:**

    ```typescript
    const pluginsToRun = new Set<string>();

    for (const type of pageTypes) {
      const phases = this.config.phases?.[type] || [];
      phases.forEach((p) => pluginsToRun.add(p));
    }
    ```

4.  **Plugin Execution & Link Extraction:**
    - Execute the selected plugins (`activePlugins`).
    - **Optimization:** Simultaneously extract all `<a>` tags during the open page session.
    - **Observability (Audit Once, Log Everywhere):**
      - Extract raw `href` AND normalized `href`.
      - If `raw !== normalized`, log a "link_issue" finding (e.g., "Internal link points to non-canonical URL").
      - Send _only_ the normalized URL to the queue for auditing.
      - This ensures we don't re-audit duplicate content, but we DO report the SEO risk of linking to it.

    ```typescript
    // Inside processJob:
    const auditPromise = runPipeline(ctx, activePlugins);
    const linksPromise = extractLinks(page); // Reuse the open page!

    const [auditResults, links] = await Promise.all([
      auditPromise,
      linksPromise,
    ]);

    // Send links back to Queue Service
    await queueService.enqueueBatched(links, { ...context });
    ```

## 2. Shared Context Optimization

To prevent plugins from triggering redundant work (like layout shifts), we share a single `CDPClient` (Chrome DevTools Protocol) session.

- **Action:** Ensure `AuditContext` passed to `runPipeline` includes the raw CDP client.
- **Application:** Heavy plugins like Lighthouse can use this existing session instead of launching a new browser tab.

To handle specific features like `<video>` or `<form>`, we can treat them as just another `PageType` definition in the config!

**Example Config:**

```json
"definitions": {
  "has_form": { "selector": "form" },
  "has_video": { "selector": "video" }
},
"phases": {
  "has_form": ["form-auditor"],
  "has_video": ["media-check"]
}
```

The `classify()` method (from Phase 2) naturally handles this because it returns _all_ matching types. If a page has a product schema AN a form, it returns `['product', 'has_form']`. The resolver effectively unions the requirements.

## 3. Worker Changes

We need to modify `packages/core/src/audit-worker.ts`.

- Import `PageClassifier`.
- Remove static plugin execution.
- Add logging for classification results (crucial for debugging).
- **Redirect Handling:**
  - Capture `response.status()` and `page.url()` after navigation.
  - If `page.url()` differs from `job.url` (client/server unique redirect), update the `results` table with `redirect_chain`.
  - **Re-Classification:** Run `classify()` on the _final_ destination URL, not the original job URL. The plugins run must match the _content actually served_.

## 4. Zombie Process Prevention

The dynamic nature of the classifier and plugins increases the risk of hanging browser processes if a plugin crashes or times out.

**Mitigation Strategy:**

1.  **Strict Timeouts:** Enforce `Promise.race([plugin.run(), timeout])` for every plugin execution.
2.  **Process Lifecycle:** Use a `try/finally` block around `browser.launch()`/`browser.close()` in the worker loop.
3.  **PID Tracking:** The Orchestrator should track the PIDs of spawned workers.
    - Implement a `process.on('SIGINT')` handler in the CLI to explicitly `kill()` all tracked worker PIDs before exiting.
    - Use `tree-kill` or similar to ensure child browser processes (which are grandchildren of the CLI) are also reaped.

## Checkpoints

- [ ] Import `PageClassifier` in `AuditWorker`.
- [ ] Implement the plugin resolution logic (union of sets).
- [ ] Pass the filtered plugin list to `runPipeline`.

## Confirmation Tests

```typescript
// integration/audit-flow.test.ts
test("runs product plugins only on product pages", async () => {
  // 1. Setup mock server serving a product page
  // 2. Configure 'product' phase => ['mock-product-plugin']
  // 3. Run audit
  // 4. Assert 'mock-product-plugin' was executed
  // 5. Assert 'blog-plugin' was NOT executed
});
```
