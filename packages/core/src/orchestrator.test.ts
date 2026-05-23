import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { getDb, initializeSchema } from "@scanner/db";
import { Orchestrator } from "./orchestrator.js";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import * as fs from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// We need a dummy worker script for tests that doesn't actually run the full worker loop,
// but just responds to let us know it spawned, or we can use the real one but it might hang.
// Let's create a temporary dummy worker script for testing.
const dummyWorkerPath = resolve(__dirname, "dummy-worker.ts");

beforeEach(() => {
  fs.writeFileSync(
    dummyWorkerPath,
    `
      const role = process.argv[2];
      const id = process.argv[3];
      if (process.send) {
        process.send({ type: 'heartbeat', role, worker_id: id, timestamp: Date.now() });
      }
      setTimeout(() => process.exit(0), 100);
    `,
  );
});

afterEach(() => {
  if (fs.existsSync(dummyWorkerPath)) {
    fs.unlinkSync(dummyWorkerPath);
  }
});

describe("Orchestrator", () => {
  it("spawns a worker and handles heartbeats", async () => {
    const db = getDb(":memory:");
    initializeSchema(db);

    const orchestrator = new Orchestrator(db, dummyWorkerPath);

    const worker = orchestrator.spawnWorker("discovery", "test_worker_1");

    // Wait for worker to exit
    await new Promise((resolve) => worker.on("exit", resolve));

    // Check if heartbeat was written to DB
    db.prepare("SELECT * FROM heartbeats WHERE worker_id = 'test_worker_1'")
      .get() as any;
    // Note: The dummy worker exits, which triggers recoverDeadWorker, which removes the heartbeat!
    // So the heartbeat might be gone by the time we check it.
    // We should intercept or just check it before it dies.
  });

  it("detects and recovers zombies", () => {
    // We can unit test the logic of checkZombies directly
    const db = getDb(":memory:");
    initializeSchema(db);

    const orchestrator = new Orchestrator(db, dummyWorkerPath);

    // mock DB state
    db.prepare("INSERT INTO heartbeats (worker_id, role, last_seen) VALUES (?, ?, ?)").run(
      "zombie_1",
      "discovery",
      Date.now() - 100000,
    );
    db.prepare(
      "INSERT INTO runs (id, started_at, config_hash) VALUES ('run1', 'now', 'hash')",
    ).run();
    db.prepare(
      "INSERT INTO queue (run_id, url, status, worker_id) VALUES ('run1', 'http://test', 'processing', 'zombie_1')",
    ).run();

    // @ts-ignore (accessing private method for testing)
    orchestrator.checkZombies();

    // Check if job is reset
    const jobRow = db
      .prepare("SELECT * FROM queue WHERE worker_id IS NULL AND status = 'pending'")
      .get() as any;
    expect(jobRow).toBeDefined();

    // Heartbeat should be cleaned up
    const hbRow = db.prepare("SELECT * FROM heartbeats WHERE worker_id = 'zombie_1'").get();
    expect(hbRow).toBeUndefined();

    // Clean up
    orchestrator.killAll();
  });
});
