# Interstitial Handling & Scenario Logic Specification

## Objective

To reliably dismiss modals, cookie banners, newsletters, and other "interstitials" that obstruct the page content during automated scanning. These elements frequently cause:

- **Identify False Positives**: `aria-hidden="true"` applied to the `<body>` while the modal is open.
- **Focus Traps**: Keyboard navigation stuck inside the modal.
- **Content Blockage**: Scanner unable to access the underlying page content.

## Strategy: The "Scenario" Architecture

We will implement a "Scenario" system that runs specific interaction scripts _after_ page load but _before_ the audit plugins (Axe/Lighthouse) execute.

### 1. Directory Structure (`packages/core/src/scenarios/`)

```
packages/core/src/scenarios/
├── index.ts           # The "Registry" (Router)
├── default.ts         # The fallback script (Generics)
└── proprietary/       # Folder for domain-specific logic
    ├── charlesandcolvard.ts
    ├── other-client.ts
    └── ...
```

### 2. The Registry (`index.ts`)

- **Function**: `resolveScenario(url: string)`
- **Logic**: Matches the current URL against a list of registered patterns (Regex/String).
- **Returns**: The specific scenario module or the `default` module if no match is found.

### 3. Scenario Module Interface

Each scenario file (e.g., `charlesandcolvard.ts`) exports:

- **`config`**: Metadata for the registry.
  - `patterns`: Array of Regex/Strings to match URLs.
  - `includeDefault`: `boolean` (Whether to run the default cleanup logic _before_ this script).
  - `exclusive`: `boolean` (If true, skip default logic entirely).
- **`run(page: Page, context: AuditContext)`**: The async function performing the interactions.

### 4. The Default Strategy (`default.ts`)

This script runs for _all_ sites (unless disabled) and implements heuristic cleanup:

1.  **Escape Key**: Press `Escape` 2-3 times with short delays.
2.  **Generic Clicker**: Query for common "dismissal" patterns:
    - `button[aria-label*="Close"]`
    - `button[class*="close"]`
    - `[aria-modal="true"] button:first-child`
    - Common ID/Class names: `#onetrust-reject-all-handler`, `.cookie-banner .dismiss`, etc.
3.  **Wait**: Small execution pause (e.g., 250ms) to allow animations to complete and attributes (like `aria-hidden`) to be removed.

## Integration Plan

**Location**: `packages/core/src/audit-worker.ts`

**Current Flow**:

1.  `page.goto(url)`
2.  Link Extraction
3.  Classification
4.  `runPipeline(...)` (Plugins)

**New Flow**:

1.  `page.goto(url)`
2.  Link Extraction
3.  Classification
4.  **`await runScenario(url, page)`** <-- NEW STEP
    - Identify matching scenario.
    - Execute `default.run()` (if applicable).
    - Execute `custom.run()` (if applicable).
    - Verify "Clean State" (optional check).
5.  `runPipeline(...)`

## Validation & Observability

How we detect if the strategy failed:

1.  **"Modal Open" Detection**:
    - Check `document.body` for classes: `modal-open`, `overflow-hidden`, `scroll-lock`.
    - Check for visible `[role="dialog"]` elements covering center screen.
2.  **Scan Metrics**:
    - **Node Count Drop**: If `axe-core` returns < 50 nodes, flag as "Obstruction Likely".
    - **`aria-hidden` Spikes**: If specific rules (`aria-hidden-body`) trigger, log a "Persistent Modal" warning.
3.  **Logs**:
    - Record which scenario ran (`default` vs `proprietary/xyz`).
    - Log specific actions taken ("Clicked #close-btn", "Pressed Escape").

## Future Extensibility

- **Cookie Injection**: Add a `cookies` property to the Scenario config to inject consent cookies _before_ navigation.
- **Network Blocking**: Add a `blockedPatterns` property to abort requests for known modal providers (e.g., `*.yotpo.com` on demand).

## Documentation

- **README Update**: Once implemented, update the main project README to describe:
  - The existence of the `scenarios` system.
  - How to add a new `proprietary` script for a difficult domain.
  - The default behaviors (Escape key, common selectors).
