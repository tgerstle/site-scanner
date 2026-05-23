# Phase 1: Transition to PNPM

## Context & Objectives

The goal of this phase is to move away from `npm workspaces` and adopt `pnpm` for faster, stricter dependency management. We will delete all existing npm artifacts and define the workspace configuration specifically for pnpm.
Currently, `package.json` relies on the `"workspaces": ["apps/*", "packages/*"]` array for npm.

## Detailed Steps

1. **Remove npm Artifacts:**
   - Command: `rm -rf node_modules package-lock.json apps/*/node_modules packages/*/node_modules`
   - Reasoning: This ensures there is no lingering state from npm that might interfere with pnpm's strict resolution.

2. **Modify Root `package.json`:**
   - Remove the `"workspaces": [...]` array entirely. pnpm handles this via a YAML file, avoiding ambiguity.

3. **Define PNPM Workspace Configuration:**
   - Create `pnpm-workspace.yaml` in the root repository.
   - Content:
     ```yaml
     packages:
       - "apps/*"
       - "packages/*"
     ```

4. **Install Dependencies via pnpm:**
   - Command: `pnpm install`
   - This explicitly reads the root `package.json` and all workspace packages/apps, resolves dependency trees, and builds `pnpm-lock.yaml`.

## Success Criteria / Regression Tests

- **Verification:** Run `pnpm ls -r`. You should see `web`, `cli`, `core`, `db`, `plugins`, and `types` listed correctly.
- **Node Modules Structure:** Inspect `node_modules` in the root and notice it contains `.pnpm` symbolic links, signifying it is working cleanly.
- **Regression Check:** Run `pnpm run test` (via Vitest) manually and verify tests still pass in the new environment format.
