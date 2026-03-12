# Phase 5: CLI & Observability

## Overview

This phase creates the Command-Line Interface (CLI) for the Adaptive Web Auditor and implements a robust, machine-readable logging system using NDJSON (Newline Delimited JSON). The CLI allows users to start, monitor, and resume audits, passing configuration options directly or via a config file.

## Detailed Checklist

- [x] **5.1 NDJSON Logger**
  - [x] Implement a structured logger utility (e.g., using `pino` or a custom implementation).
  - [x] Ensure all logs output one JSON object per line.
  - [x] Replace all `console.log` calls in the codebase with the structured logger.
- [x] **5.2 CLI Entry Point**
  - [x] Build the CLI entry point using a library like `commander` or `mri`.
  - [x] Implement argument parsing to populate the `ScannerConfig`.
  - [x] Allow passing a configuration file path via `-c, --config`.
- [x] **5.3 CLI Commands**
  - [x] `start`: Initiate a new audit run (requires `--url` or `--config`).
  - [x] `resume`: Resume an interrupted run (requires `--run-id`).
  - [x] `status`: View the progress of an ongoing run.
- [x] **5.4 Event Taxonomy**
  - [x] Standardize log events (e.g., `worker_started`, `plugin_error`, `audit_complete`).

## Types & Interfaces

```typescript
// packages/types/src/logging.ts
export type LogSeverity = "info" | "warn" | "error" | "debug";

export interface LogEvent {
  event: string;
  plugin?: string;
  url?: string;
  severity: LogSeverity;
  message: string;
  [key: string]: any; // Allow additional context
}
```

## Code Example: NDJSON Logger & CLI Setup

```typescript
// packages/core/src/logger.ts
import { LogEvent } from "types/logging";

export function logEvent(event: LogEvent) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    ...event,
  };
  // Write to stdout as a single JSON line
  process.stdout.write(JSON.stringify(logEntry) + "\n");
}

// packages/cli/src/index.ts
import { Command } from "commander";
import { ScannerConfigSchema } from "types/config";

const program = new Command();

program
  .command("start")
  .description("Start a new audit run")
  .option("-c, --config <path>", "Path to config file (e.g., awaconfig.json)")
  .option("-u, --url <url>", "Target URL to audit (overrides config)")
  .option("-d, --depth <number>", "Maximum crawl depth", "3")
  .option("-p, --plugins <plugins...>", "Plugins to run")
  .action((options) => {
    // Logic to merge file config and CLI args...
    const config = ScannerConfigSchema.parse({
      siteUrl: options.url, // if provided
      maxDepth: parseInt(options.depth, 10),
      plugins: options.plugins || ["axe", "lighthouse"],
    });

    logEvent({
      event: "run_started",
      severity: "info",
      message: `Starting audit for ${config.siteUrl}`,
      config,
    });

    // Initialize Orchestrator with config...
  });

program.parse(process.argv);
```

## Testing Requirements

- [x] **Test 5.1**: Logger outputs valid JSON strings with the required `timestamp`, `event`, and `severity` fields.
- [x] **Test 5.2**: CLI correctly parses arguments and validates them against the `ScannerConfigSchema`.
- [x] **Test 5.2b**: CLI correctly loads and merges a JSON config file via the `-c` argument.
- [x] **Test 5.3**: CLI `start` command successfully initializes the database and spawns the Orchestrator.
- [x] **Test 5.4**: CLI `resume` command correctly identifies pending queue items for a given `run_id` and restarts the Orchestrator.
