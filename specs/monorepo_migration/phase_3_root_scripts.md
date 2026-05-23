# Phase 3: Root Scripts Optimization

## Context & Objectives

The root `package.json` contains scripts like `"dev": "npm run dev --workspace=web"`. With Turborepo and pnpm installed, we can generalize the root scripts to run across the monorepo cleanly utilizing Turbo's orchestration.

## Detailed Steps

1. **Modify Root `package.json` Scripts:**
   - Replace the current npm-specific scripts with Turborepo commands.
   - Update to:
     ```json
     "scripts": {
       "dev": "turbo run dev",
       "start": "turbo run start",
       "build": "turbo run build",
       "test": "turbo run test",
       "test:e2e": "vitest run tests/integration/scanner.test.ts",
       "test:golden": "vitest run tests/integration/classifier-suite",
       "test:unit": "vitest run packages/core/src/plugin-resolver.test.ts",
       "test:watch": "vitest",
       "lint": "oxlint --ignore-path .oxlintignore",
       "format": "oxfmt --write .",
       "clean": "turbo run clean",
       "kill:zombies": "pkill -f 'packages/cli' || echo 'No'; pkill -f 'headless' || echo 'No'"
     }
     ```

2. **Align Internal Scripts:**
   - Ensure the internal packages expose the expected scripts. `cli`, `core`, `db`, `plugins`, `types` all currently have a `"build": "tsc -b"` script, which maps perfectly.
   - Ensure the `web` app exposes `"dev"`, `"build"`, etc.

## Success Criteria / Regression Tests

- **Verification:** Run `pnpm run build` from the root. It should execute Turbo cleanly and build the graph.
- **Verification:** Run `pnpm run dev`. It should boot the Astro dev server for `web` but also stream output appropriately.
- **Regression Check:** Try running standard workflow commands (`pnpm test`, `pnpm build`) and observe no loss in functionality from the previous single-workspace CLI usage.
