# Phase 2: Introduce Turborepo

## Context & Objectives

Turborepo (`turbo`) allows caching, task parallelization, and intelligent dependency tracking for builds, tests, and linting. Adding this will speed up CI and local workflows significantly.

## Detailed Steps

1. **Install Turbo:**
   - Command: `pnpm add turbo -w -D`
   - This installs `turbo` at the workspace root as a development dependency.

2. **Add Turbo Configuration (`turbo.json`):**
   - Create `turbo.json` at the root directory to define the pipeline.
   - We must consider that `cli`, `core`, `db`, `plugins`, and `types` all use `tsc -b` for builds, and `web` uses `astro build`. They depend on one another.
   - Content:
     ```json
     {
       "$schema": "https://turbo.build/schema.json",
       "tasks": {
         "build": {
           "dependsOn": ["^build"],
           "outputs": ["dist/**", ".astro/**", "apps/web/dist/**"]
         },
         "test": {
           "dependsOn": ["^build"]
         },
         "lint": {},
         "format": {},
         "clean": {
           "cache": false
         },
         "dev": {
           "cache": false,
           "persistent": true
         }
       }
     }
     ```
     _Note: `^build` ensures dependencies (like `types` or `db`) are built before the packages that rely on them (like `core` or `web`)._

3. **Ignore Turbo Artifacts:**
   - Ensure `.turbo` is added to `.gitignore`.

## Success Criteria / Regression Tests

- **Verification:** Run `pnpm dlx turbo run build`.
- **Cache Check:** Run `pnpm dlx turbo run build` a second time immediately. You should see `FULL TURBO` or `x cached, 0 completed`, signifying caching is working.
- **Dependency Flow:** Modifying a file in `types/src/index.ts` and running `turbo check` or `turbo build` should trigger a rebuild of `types` followed by `core`, `cli`, etc., cascading correctly.
