# Phase 1: Configuration & Types

**Goal:** Define the data structures that allow users to map Page Types to detection rules (Selectors/URLs) and execution phases (Plugins).

**Status:** Not Started

## 1. Zod Schema Definitions

We need to update `packages/types/src/config.ts` to support the new `definitions` and `phases` properties.

### Proposed Interface

```typescript
// packages/types/src/config.ts

export interface PageDefinition {
  /**
   * CSS selector or text content to identify this page type.
   * HIGHER PRECEDENCE than urlPattern.
   * Example: "script[type='application/ld+json']:contains('Product')"
   */
  selector?: string;

  /**
   * Regex pattern to match the URL.
   * LOWER PRECEDENCE than selector.
   * Example: "/products?/"
   */
  urlPattern?: string;

  /**
   * Optional: Patterns to explicitly exclude from this type.
   */
  excludePattern?: string;
}

export interface PluginConfigObj {
  name: string;
  /**
   * Optional configuration passed to the plugin instance.
   * Allows control over severity (e.g., "only critical"), standards, etc.
   */
  options?: Record<string, any>;
  /**
   * Overrides the default group for logging (e.g., "seo", "security")
   */
  group?: string;
}

export interface ScannerConfig {
  // Existing...
  siteUrl: string;
  maxDepth: number;

  /**
   * Defines how to identify a page type.
   * Key = Page Type ID (e.g., "product", "blog")
   */
  definitions?: Record<string, PageDefinition>;

  /**
   * Maps a Page Type to a list of plugins to execute.
   * Key = Page Type ID
   * Value = Array of plugin names OR config objects.
   * Example: ["seo-tech", { name: "axe", options: { tags: ["wcag2a"] } }]
   */
  phases?: Record<string, (string | PluginConfigObj)[]>;

  /**
   * If true, the system uses the internal default configuration
   * as a base and merges the user config on top.
   * Default: true
   */
  useDefaults?: boolean;
}
```

## 2. Default Configuration

We must provide a robust default set of rules in `packages/core/src/default-config.ts`.

```typescript
// packages/core/src/default-config.ts
import { ScannerConfig } from "types";

export const DEFAULT_CONFIG: Partial<ScannerConfig> = {
  definitions: {
    product: {
      selector:
        ".product-price, script[type='application/ld+json']:contains('Product')",
      urlPattern: "/(product|item|p)/",
    },
    article: {
      selector:
        "article, script[type='application/ld+json']:contains('Article')",
      urlPattern: "/(blog|news|article)/",
    },
    cart: {
      urlPattern: "/(cart|checkout|basket)/",
    },
  },
  phases: {
    // Global plugins run on basically everything unless explicitly disabled
    global: ["seo-tech", "performance"],

    // Type-specific
    product: [
      { name: "axe", options: { rules: ["color-contrast"] } },
      "product-structure",
    ],
    article: ["axe", "readability"],

    // Complex flows
    cart: ["checkout-security", "form-analytics"],
  },
};
```

## 3. Merge Logic

We need a utility to deeply merge the Default Config with the User Config.

**Requirement:**

- User definitions _add to_ or _override_ defaults.
- User phases _replace_ defaults for that key, OR enable mapped merging (e.g. `["+plugin"]`).
- **Decision:** For V1, let's keep it simple: User arrays _replace_ default arrays for a specific key. If a user wants to add a plugin to "product", they must list the default ones too or we provide a helper.
- **Better approach:** Allow string commands like `"-plugin"` to remove or `"+plugin"` to add?
- **Final Decision for V1:** Simple replacement. If you define `"product": ["my-plugin"]`, you opt out of the defaults for "product".

## Checkpoints

- [ ] Update `packages/types/src/config.ts` with `PageDefinition` and `ScannerConfig`.
- [ ] Create `packages/core/src/default-config.ts`.
- [ ] Update `packages/cli/src/config-loader.ts` (or equivalent) to implement the merge logic.

## Confirmation Tests

```typescript
// tests/config-merge.test.ts
test("merges user config with defaults", () => {
  const userConfig = {
    definitions: {
      custom: { urlPattern: "/custom/" },
    },
  };
  const merged = loadConfig(userConfig);
  expect(merged.definitions.product).toBeDefined(); // From default
  expect(merged.definitions.custom).toBeDefined(); // From user
});
```
