import { describe, it, expect } from "vitest";
import { getDb, initializeSchema } from "./connection.js";
import {
  updateHeartbeat,
  getDeadWorkers,
  removeHeartbeat,
  resetDeadWorkerJobs,
} from "./heartbeats.js";
import { insertJob, claimNextJob } from "./queue.js";

describe("Heartbeats", () => {
  it("updates and retrieves heartbeats correctly", () => {
    const db = getDb(":memory:");
    initializeSchema(db);

    const now = Date.now();
    updateHeartbeat(db, "worker_1", "discovery", now - 10000); // 10s ago
    updateHeartbeat(db, "worker_2", "audit", now - 70000); // 70s ago

    const deadWorkers = getDeadWorkers(db, now, 60000);
    expect(deadWorkers.length).toBe(1);
    expect(deadWorkers[0].worker_id).toBe("worker_2");

    removeHeartbeat(db, "worker_2");
    const deadWorkersAfterRemove = getDeadWorkers(db, now, 60000);
    expect(deadWorkersAfterRemove.length).toBe(0);
  });

  it("resets dead worker jobs", () => {
    const db = getDb(":memory:");
    initializeSchema(db);

    db.exec("INSERT INTO runs (id, started_at, config_hash) VALUES ('run1', 'now', 'hash')");
    insertJob(db, { run_id: "run1", url: "http://test.com", depth: 1 });

    // Claim it
    const job = claimNextJob(db, "dead_worker", "discovery");
    expect(job?.status).toBe("processing");
    expect(job?.worker_id).toBe("dead_worker");

    // Reset it
    resetDeadWorkerJobs(db, "dead_worker");

    // Check if it's pending again
    const row = db.prepare("SELECT * FROM queue WHERE id = ?").get(job?.id) as any;
    expect(row.status).toBe("pending");
    expect(row.worker_id).toBeNull();
  });
});
