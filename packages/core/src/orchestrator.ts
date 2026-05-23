import { fork, type ChildProcess } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { IPCMessage, WorkerRole } from "@scanner/types";
import { updateHeartbeat, getDeadWorkers, resetDeadWorkerJobs, removeHeartbeat } from "@scanner/db";
import type Database from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));

export class Orchestrator {
  private workers = new Map<string, ChildProcess>();
  private db: Database.Database;
  private workerScript: string;
  private zombieTimer?: NodeJS.Timeout;

  constructor(db: Database.Database, workerScriptPath?: string) {
    this.db = db;
    // Default assumes dist/worker.js when run from compiled core
    this.workerScript = workerScriptPath ?? resolve(__dirname, "../dist/worker.js");
  }

  startZombieDetection(intervalMs: number = 30000) {
    this.zombieTimer = setInterval(() => this.checkZombies(), intervalMs);
  }

  stopZombieDetection() {
    if (this.zombieTimer) clearInterval(this.zombieTimer);
  }

  spawnWorker(role: WorkerRole, workerId: string): ChildProcess {
    // Pass args to the worker script
    const worker = fork(this.workerScript, [role, workerId], {
      // if compiling on the fly for tests, this might need tsx via execArgv
      execArgv: process.execArgv.some((arg) => arg.includes("tsx")) ? ["--import", "tsx"] : [],
    });

    worker.on("message", (msg: IPCMessage) => {
      if (msg.type === "heartbeat") {
        updateHeartbeat(this.db, msg.worker_id, msg.role, msg.timestamp);
      }
    });

    worker.on("exit", (_code) => {
      this.workers.delete(workerId);
      // Let zombie detection handle it, or recover immediately
      this.recoverDeadWorker(workerId, role);
    });

    this.workers.set(workerId, worker);
    return worker;
  }

  killAll() {
    for (const [_, worker] of this.workers) {
      worker.kill();
    }
    this.workers.clear();
  }

  private recoverDeadWorker(workerId: string, role: WorkerRole) {
    resetDeadWorkerJobs(this.db, workerId);
    removeHeartbeat(this.db, workerId);
    this.workers.delete(workerId);

    // Try to preserve the runId prefix if it exists
    // Expected format: run_TIMESTAMP_HASH_role_suffix
    let newWorkerId = `${role}-${Date.now()}`;
    const parts = workerId.split('_');

    // Heuristic: if it looks like a valid run ID structure (run_TIMESTAMP_HASH_...)
    if (parts.length >= 4 && parts[0] === 'run') {
      const runPrefix = parts.slice(0, 3).join('_');
      newWorkerId = `${runPrefix}_${role.substring(0, 3)}_rec_${Date.now().toString().slice(-6)}`;
    }

    // Spawn a replacement
    this.spawnWorker(role, newWorkerId);
  }

  private checkZombies() {
    const deadWorkers = getDeadWorkers(this.db, Date.now(), 60000);
    for (const { worker_id, role } of deadWorkers) {
      // Force kill if it's still somehow in process map but stopped reporting
      const cp = this.workers.get(worker_id);
      if (cp) cp.kill();

      this.recoverDeadWorker(worker_id, role);
    }
  }
}
