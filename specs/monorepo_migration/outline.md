# Monorepo Migration Plan

## Overview

This document outlines the steps to convert the current npm workspaces setup into a more professional monorepo architecture leveraging **pnpm** and **Turborepo**.

## Phase 1: Transition to PNPM

- Delete the existing `package-lock.json` and all `node_modules` directories.
- Remove the `"workspaces": [...]` array from the root `package.json`.
- Create a `pnpm-workspace.yaml` in the root directory to define the workspace:
  ```yaml
  packages:
    - "apps/*"
    - "packages/*"
  ```
- Run `pnpm install` to generate a new `pnpm-lock.yaml`.

## Phase 2: Introduce Turborepo

- Install the `turbo` package as a dev dependency to the root: `pnpm add turbo -w -D`.
- Create a `turbo.json` file in the root to define task caching and pipelines:
  ```json
  {
    "$schema": "https://turbo.build/schema.json",
    "tasks": {
      "build": {
        "dependsOn": ["^build"],
        "outputs": ["dist/**", "build/**", "apps/web/dist/**"]
      },
      "test": {
        "dependsOn": ["^build"]
      },
      "lint": {},
      "format": {},
      "dev": {
        "cache": false,
        "persistent": true
      }
    }
  }
  ```

## Phase 3: Modernize Root Scripts

- Update the `scripts` section in the root `package.json` to trigger tasks via Turborepo:
  ```json
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "format": "turbo run format"
  }
  ```

## Phase 4: Optimize File Structure & Scoping

- **Package Scoping**: Rename packages in their respective `package.json` files to use a predefined organization scope (e.g., `@scanner/core`, `@scanner/cli`, `@scanner/db`).
- **Shared Configurations**: Implement shared configuration packages to centralize standards.
  - Create `packages/config-typescript` to hold a shared base `tsconfig.json`.
  - Create `packages/config-lint` for sharing oxlint/eslint rules.
- Update all internal package references to use the new exact scoped names (e.g. `pnpm add @scanner/core --filter @scanner/cli`).
