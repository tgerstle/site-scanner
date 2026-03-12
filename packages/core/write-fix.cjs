const fs = require("fs");
const content = `import type { WorkerRole } from "types";
import { logEvent } from "./logger.js";
import { getDb } from "db";
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

    let worker: WorkerLoop;
    if (role === "discovery") {
        worker = new DiscoveryWorker(workerId, db, {} as any);
        worker.start();
        process.on("SIGINT", () => worker!.stop());
        process.on("SIGTERM", () => worker!.stop());
    } else {
        // dynamically load plugins or fallback internally
        loadPlugins([]).then(pl => {
            worker = new AuditWorker(workerId, db, {} as any, pl);
            worker.start();
            process.on("SIGINT", () => worker!.stop());
            process.on("SIGTERM", () => worker!.stop());
        }).catch(err => {
            logEvent({ event: "worker_error", severity: "error", message: "Failed to load plugins for audit worker", error: String(err) });
            process.exit(1);
        });
    }
}`;

fs.writeFileSync("/Users/tgerstle/code/aa_live_sites/scanner/packages/core/src/worker.ts", content);
