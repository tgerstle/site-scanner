
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/**/*.{test,spec}.ts', 'packages/**/src/**/*.{test,spec}.ts'],
        pool: 'threads',
        poolOptions: {
            threads: {
                singleThread: true
            }
        },
        testTimeout: 120000,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'lcov'],
            // Only measure source in the workspace packages.
            include: ['packages/*/src/**/*.ts'],
            exclude: [
                '**/*.test.ts',
                '**/dist/**',
                '**/*.d.ts',
                'apps/web/**',
                // Entrypoint / process-forking glue that unit tests cannot drive in-process.
                'packages/cli/src/**',
                'packages/core/src/worker.ts',
            ],
            // Baseline thresholds — set just below the measured baseline (stmts ~17 / branch
            // ~15 / funcs ~20 / lines ~17 for the `test:coverage` subset). Ratchet UP over time
            // as coverage grows; do NOT chase 100. A drop below these fails the command.
            thresholds: {
                lines: 15,
                functions: 18,
                branches: 14,
                statements: 15,
            },
        },
    },
});
