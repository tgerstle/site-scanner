# Phase 4 Spec: Test Coverage Tooling

## Status: Done

## Implementation notes (as built)
- Provider `@vitest/coverage-v8` added at the workspace root.
- Coverage config lives in the existing root `vitest.config.ts` (a `coverage` block was added to the existing `test` config rather than a new file).
- `test:coverage` runs the **stable unit-test subset** (worker-base, discovery, config, plugin-resolver, db) with `--coverage`, mirroring the repo's existing pattern of targeting specific files (`test:unit`/`test:e2e`/`test:golden`). The heavy Playwright integration tests and the `.ts`-forking orchestrator test are excluded from the gate because they can't run reliably headless.
- Measured baseline for that subset: ~17% statements / ~15% branches / ~20% functions / ~17% lines (diluted by unexercised plugin/scenario files that are still counted). Thresholds set just below (15/14/18/15) as a ratchet floor.
- `coverage/` added to `.gitignore`.


## 1. Goal
Make the per-phase test criteria in Phases 0–3 enforceable by wiring up Vitest coverage reporting with a threshold gate, so regressions in the new concurrency/throttle/stealth paths surface in CI.

## 2. Background
The repo already uses Vitest (`vitest@^4.0.18`) with `test`/`test:e2e`/`test:golden`/`test:unit` scripts in the root [package.json](package.json), and `turbo run test` per package. There is currently **no** coverage collection or threshold — nothing fails when a code path is untested.

## 3. Changes

### 3a. Coverage provider
Add the V8 coverage provider dev dependency at the root (matches the Vitest major): `@vitest/coverage-v8@^4`.

### 3b. Vitest config
Add (or extend) a root `vitest.config.ts` with a coverage block:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["packages/*/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/dist/**", "**/*.d.ts", "apps/web/**"],
      thresholds: {
        // Start at the current baseline, ratchet up over time. Do NOT set 100 on day one.
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60,
      },
    },
  },
});
```

- **Ratchet, don't gate at 100.** Measure the baseline first (`pnpm test:coverage`), set thresholds at or just below the current numbers, then raise them as the new phases add tests. A threshold above the real baseline would make CI red immediately.
- Scope `include` to `packages/*/src` so app/web and build output don't dilute the signal.

### 3c. Scripts
Add to root [package.json](package.json):
```json
"test:coverage": "vitest run --coverage"
```
Leave the existing `test` scripts and `turbo run test` untouched so the default fast path is unchanged.

### 3d. CI wiring
The existing GitHub Action runs `pnpm ci:local` (`lint && build && test`). Add a coverage step (or swap `test` → `test:coverage` in CI only) so the threshold gate runs in CI without slowing local `pnpm test`.

### 3e. Ignore artifacts
Add `coverage/` to `.gitignore`.

## 4. Success Criteria
- [ ] `pnpm test:coverage` produces a text summary + `coverage/` HTML report.
- [ ] Thresholds are set at/near the measured baseline and the command passes on a clean checkout.
- [ ] Removing a covered test drops coverage below threshold and fails the command (proves the gate works).
- [ ] CI runs coverage; local `pnpm test` stays coverage-free (fast).

## 5. Priority
Lands **after** Phases 0–3 so the baseline is measured against the final code, and the new unit tests (delay calculator, launch-args, context-builder) are counted. Independent of the runtime behavior of the other phases.
