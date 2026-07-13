import { describe, it, expect } from "vitest";
import { getDb, initializeSchema } from "./connection.js";
import { claimNextJob, insertJob } from "./queue.js";

describe("Database Connection", () => {
  it("creates an in-memory database", () => {
    const db = getDb(":memory:");
    expect(db).toBeDefined();
  });

  it("initializes schema without errors", () => {
    const db = getDb(":memory:");
    expect(() => initializeSchema(db)).not.toThrow();
  });
});

describe("Queue Management", () => {
  it("atomically assigns a job without race conditions", () => {
    const db = getDb(":memory:");
    initializeSchema(db);

    db.exec("INSERT INTO runs (id, started_at, config_hash) VALUES ('run1', 'now', 'hash')");

    // Insert multiple identical priority tasks
    for (let i = 0; i < 5; i++) {
      insertJob(db, { run_id: "run1", url: `http://test.com/${i}`, depth: 1 });
    }
    // Claim jobs
    const job1 = claimNextJob(db, "worker_A", "discovery");
    const job2 = claimNextJob(db, "worker_B", "discovery");

    expect(job1).toBeDefined();
    expect(job2).toBeDefined();
    expect(job1!.id).not.toBe(job2!.id);
    expect(job1!.worker_id).toBe("worker_A");
    expect(job2!.worker_id).toBe("worker_B");
    expect(job1!.status).toBe("processing_discovery");
  });

  it("stores resource metadata when inserting jobs", () => {
    const db = getDb(":memory:");
    initializeSchema(db);
    db.exec("INSERT INTO runs (id, started_at, config_hash) VALUES ('run1', 'now', 'hash')");

    insertJob(db, {
      run_id: "run1",
      url: "https://example.com/files/brochure.pdf",
      depth: 1,
      priority: 7,
      resource_type: "document",
      audit_disposition: "auditable_document",
      skip_reason: null,
      source: "crawl",
      discovered_from: "https://example.com/home",
    });

    const row = db.prepare("SELECT * FROM queue WHERE run_id = 'run1'").get() as any;
    expect(row.resource_type).toBe("document");
    expect(row.audit_disposition).toBe("auditable_document");
    expect(row.source).toBe("crawl");
    expect(row.discovered_from).toBe("https://example.com/home");
  });
});
