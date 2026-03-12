# Phase 5: Testing Strategy & Validation

**Goal:** Ensure that we can verify the "Cascading" logic logic without manual checks, and catch regressions as we add new capabilities.

**Status:** Not Started

## 1. The "Golden Master" Regression Suite

Since we are building a complex decision engine (URLs -> Types -> Plugins -> Results), we need a suite of tests that verify the _decisions_ made by the system.

### Test Architecture

We will create a specific integration test folder: `tests/integration/classifier-suite/`.

Inside, we will have:

1.  **Fixtures:** A folder of static HTML files representing different page types.
    - `product-simple.html`
    - `blog-post.html`
    - `generic.html`
2.  **Expected Manifest (`golden.json`):** A JSON file defining what _should_ happen for each fixture.

```json
{
  "product-simple.html": {
    "detectedTypes": ["product", "global"],
    "phases": ["product", "global"],
    "plugins": ["seo-tech", "axe", "product-structure"]
  },
  "blog-post.html": {
    "detectedTypes": ["article", "global"],
    "plugins": ["axe", "readability"]
  }
}
```

### The Test Runner

We will write a Vitest test that:

1.  Spins up a local static server for the `fixtures` folder.
2.  Initializes the detector/configuration logic.
3.  Runs the `classify()` and `resolvePlugins()` steps for each URL.
4.  Compares the output against `golden.json`.

**Why this is good:**

- **Composability Check:** If you change a default rule, the test fails and shows you exactly what "cascade" changed.
- **Simplicity:** Adding a new test case is just adding an HTML file and updating the JSON.

## 2. Unit Testing "Configuration Composition"

We need to verify that our complex object merging (Default Config + User Overrides + Options) works correctly.

**Test Case: "Severity Override"**

- **Goal:** User wants to run Axe on "critical" only for `global` type, but "all" for `accessibility-page` type.
- **Config:**
  ```javascript
  phases: {
    "global": [{ name: "axe", options: { impacts: ["critical"] } }],
    "a11y-focus": [{ name: "axe", options: { impacts: ["critical", "serious", "moderate"] } }]
  }
  ```
- **Verification:** Ensure `loadPlugins` receives the correct options object for the correct context.

## 3. Performance Testing (Future)

We should add a benchmark test that measures the **Time to Classification**. Since the classifier runs on _every_ page, it must be fast (sub-100ms).

- **Benchmark:** Run `classify()` on 100 pages. assert avg time < 50ms.

## Checkpoints

- [ ] Create `tests/fixtures/` with representative HTML.
- [ ] Implement `tests/integration/golden-master.test.ts`.
- [ ] Add `npm run test:golden` command.
