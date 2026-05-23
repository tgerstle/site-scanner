# Phase 4: Scoping and Shared Configurations

## Context & Objectives

To truly professionalize the monorepo, packages should be properly scoped securely (e.g. `@scanner/*`) instead of broad names like `core` or `db`. Also, shared configurations (TypeScript, oxlint) prevent drift.

## Detailed Steps

1. **Create Shared Configuration Packages:**
   - Create `packages/config-typescript`:
     - Contains a generic `package.json`.
     - Contains `base.json` (strict TS configs).
   - _Note: We will avoid breaking existing tsconfigs immediately, but set up the infrastructure to extend from them._

2. **Package Name Scoping:**
   - Modify the `name` field in all package `package.json` files:
     - `apps/web` -> `@scanner/web`
     - `packages/cli` -> `@scanner/cli`
     - `packages/core` -> `@scanner/core`
     - `packages/db` -> `@scanner/db`
     - `packages/plugins` -> `@scanner/plugins`
     - `packages/types` -> `@scanner/types`

3. **Update Internal Dependencies:**
   - Scoped internal package references must be updated. For instance, in `apps/web/package.json`, change dependency `"core": "*"` to `"@scanner/core": "workspace:*"`.
   - Update `packages/cli/package.json`: `"@scanner/core": "workspace:*", "@scanner/db": "workspace:*"`, etc.
   - Do this for all inter-dependencies (`plugins`, `core`, `db`, `types`, `cli`, `web`).
   - Using `"workspace:*"` explicitly tells pnpm this must be resolved from the local monorepo, adding safety so it doesn't accidentally fetch from the public npm registry.

4. **Update Import Statements (TypeScript):**
   - Search globally and replace non-scoped imports with scoped imports if internal path aliases relied on package names.
   - _Example:_ if `import { X } from 'core'` is used, change to `import { X } from '@scanner/core'`.

## Success Criteria / Regression Tests

- **Verification:** Run `pnpm install` again. It should rebuild symlinks with the `@scanner` scope in `node_modules`.
- **Verification:** Run `pnpm build` (Turbo setup from Phase 3). All packages should compile correctly, satisfying their type imports.
- **Regression Check:** Run `pnpm test` and `pnpm test:e2e` to ensure the core orchestrator builds and links the internal plugins appropriately through the new module resolver handles.
