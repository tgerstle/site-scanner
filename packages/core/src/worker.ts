import { ScannerConfig } from "@scanner/types";
import type { WorkerRole } from "@scanner/types";
import { logEvent } from "./logger.js";
import { getDb, getRunConfig } from "@scanner/db"; // Implicitly returns ScannerConfig
import * as path from "node:path";
import { AuditWorker } from "./audit-worker.js";
import { loadPlugins } from "./plugin-loader.js";
import { pathToFileURL } from "node:url";
import { WorkerLoop } from "./worker-base.js";

// Re-export WorkerLoop so index.ts export continues to work without changing index.ts
export { WorkerLoop };

// Entry point when spawned as a child process
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const role = process.argv[2] as WorkerRole;
  const workerId = process.argv[3];

  if (!role || !workerId) {
    logEvent({ event: "worker_error", severity: "error", message: "Missing role or workerId" });
    process.exit(1);
  }

  const dbPath = process.env.AWA_DB_PATH || path.resolve(process.cwd(), "data/awa.sqlite");
  const db = getDb(dbPath);

  // Parse Run ID from workerId (format: runId_role_suffix)
  const parts = workerId.split('_');
  // Heuristic: run IDs typically have 3 components (run_TIMESTAMP_HASH).
  // But if that changes, this is brittle.
  // Better approach: pass runId as explicit argument. 
  // For now, reconstruct based on known pattern.
  const runId = parts.slice(0, 3).join('_');

  let worker: WorkerLoop | undefined;

  // Retrieve configuration
  const runConfig = getRunConfig(db, runId) as ScannerConfig;

  {
    // Consolidated worker: the single 'audit' worker performs discovery + auditing inline.
    // Collect all plugins needed for the run (legacy + cascading phases)
    const pluginSet = new Set<string>();

    // 1. Legacy plugins array
    if (runConfig.plugins) {
      runConfig.plugins.forEach(p => pluginSet.add(p));
    }

    // 2. Cascading phases
    if (runConfig.phases) {
      Object.values(runConfig.phases).forEach(phasePlugins => {
        phasePlugins.forEach(p => {
          if (typeof p === 'string') {
            pluginSet.add(p);
          } else {
            pluginSet.add(p.name);
          }
        });
      });
    }

    // Default fallback if absolutely nothing is found (shouldn't happen with defaults)
    if (pluginSet.size === 0) {
      logEvent({ event: "worker_warning", severity: "warn", message: `No plugins found in config for run ${runId}, defaulting to 'axe'`, workerId });
      pluginSet.add("axe");
    }

    const pluginsToLoad = Array.from(pluginSet);

    logEvent({
      event: "worker_init",
      severity: "info",
      message: `Loading plugins: ${pluginsToLoad.join(", ")}`,
      workerId
    });

    loadPlugins(pluginsToLoad)
      .then((pl) => {
        worker = new AuditWorker(workerId, db, runConfig, pl);
        worker.start();
      })
      .catch((err) => {
        logEvent({
          event: "worker_error",
          severity: "error",
          message: "Failed to load plugins for audit worker",
          error: String(err),
        });
        process.exit(1);
      });
  }

  if (role === "audit") {
    // Clean shutdown
    const shutdown = () => {
      if (worker) worker.stop();
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  }
}
