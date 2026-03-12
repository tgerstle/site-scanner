import type { WorkerRole } from "types";
import { logEvent } from "./logger.js";
import { getDb, getRunConfig } from "db";
import * as path from "node:path";
import { DiscoveryWorker } from "./discovery-worker.js";
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

  // Extract Run ID from workerId (format: runId_role_suffix)
  // e.g., run_123_aud_1 -> run_123 (assuming run id includes 'run_')
  // We can try to extract up to the second underscore if we follow the pattern exactly,
  // or pass runId as an arg.
  // Given current implementation in orchestrator: `${runId}_disc_1`
  // And runId starts with run_.
  // Let's perform a safer heuristic: runId is everything before last 2 underscores?
  // Actually, runId is variable length.
  // Let's assume the runId is embedded at the start.
  // Or, safer: modify orchestrator to pass runId.
  // But for now, let's extract it. The workerId is `${runId}_${role.substring(0,3)}_1`.
  // So splitting by '_' from right might not work if runId has underscores (it does).
  // But role suffix is fixed pattern from orchestrator.

  // However, fetching config for the *Run* is best practice.
  // Since we don't have runId passed explicitly, let's try to parse it.
  // The runId format is: `run_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`.
  // It has 3 parts separated by underscores.
  // The workerId adds `_disc_1`.
  // So workerId looks like: `run_TIMESTAMP_HASH_disc_1`.
  // So we can join the first 3 parts.
  const parts = workerId.split('_');
  const runId = parts.slice(0, 3).join('_');

  let worker: WorkerLoop;
  if (role === "discovery") {
    const config = getRunConfig(db, runId); // Fetch config
    worker = new DiscoveryWorker(workerId, db, config);
    worker.start();
    process.on("SIGINT", () => worker!.stop());
    process.on("SIGTERM", () => worker!.stop());
  } else {
    // dynamically load plugins from run config
    const runConfig = getRunConfig(db, runId);
    const pluginsToLoad = runConfig.plugins || [];

    // Fallback?
    if (pluginsToLoad.length === 0) {
      logEvent({ event: "worker_warning", severity: "warn", message: `No plugins found in config for run ${runId}`, workerId });
    }

    loadPlugins(pluginsToLoad)
      .then((pl) => {
        worker = new AuditWorker(workerId, db, runConfig, pl);
        worker.start();
        process.on("SIGINT", () => worker!.stop());
        process.on("SIGTERM", () => worker!.stop());
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
}
