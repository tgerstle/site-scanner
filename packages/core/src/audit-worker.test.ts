import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { getDb, initializeSchema, insertJob } from "@scanner/db";
import { AuditWorker } from "./audit-worker.js";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import type { AuditPlugin } from "@scanner/types";

describe("AuditWorker", () => {
  let server: FastifyInstance;
  let baseUrl: string;

  beforeEach(async () => {
    server = Fastify();

    server.get("/", async (request, reply) => {
      reply.type("text/html").send(`
        <html>
          <head><title>Test</title></head>
          <body><h1>Test</h1></body>
        </html>
      `);
    });

    await server.listen({ port: 0 });
    const address = server.server.address();
    if (address && typeof address !== "string") {
      baseUrl = `http://localhost:${address.port}`;
    }
  });

  afterEach(async () => {
    await server.close();
  });

  it("processes a job, runs plugins, and saves results", async () => {
    const db = getDb(":memory:");
    initializeSchema(db);

    db.exec("INSERT INTO runs (id, started_at, config_hash) VALUES ('run1', 'now', 'hash')");
    insertJob(db, { run_id: "run1", url: baseUrl, depth: 0 });

    const dummyPlugin: AuditPlugin = {
      name: "dummy",
      async run(ctx) {
        ctx.results.seo_score = 99;
        ctx.results.custom_data = { testData: "hello" };
      },
    };

    const worker = new AuditWorker(
      "audit-1",
      db,
      {
        siteUrl: baseUrl,
        phases: { global: ["dummy"] },
      } as any,
      [dummyPlugin],
      9223,
    ); // Use a different port to avoid conflicts

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    await worker.processJob(); // Should pick up the job and run dummyPlugin

    const job = db.prepare("SELECT * FROM queue WHERE depth = 0").get() as any;
    expect(job.status).toBe("completed");

    const result = db.prepare("SELECT * FROM results WHERE run_id = 'run1'").get() as any;
    expect(result).toBeDefined();
    expect(result.seo_score).toBe(99);
    const customData = JSON.parse(result.custom_data);
    expect(customData.testData).toBe("hello");

    await worker.stop();
    exitSpy.mockRestore();
  }, 15000);

  it("skips non-html jobs before running plugins", async () => {
    const db = getDb(":memory:");
    initializeSchema(db);

    db.exec("INSERT INTO runs (id, started_at, config_hash) VALUES ('run2', 'now', 'hash')");
    insertJob(db, {
      run_id: "run2",
      url: "https://example.com/files/brochure.pdf",
      depth: 0,
      resource_type: "document",
      audit_disposition: "auditable_document",
      source: "crawl",
      discovered_from: "https://example.com/home",
    });

    const dummyPlugin: AuditPlugin = {
      name: "dummy",
      async run() {
        throw new Error("should not run");
      },
    };

    const worker = new AuditWorker(
      "audit-2",
      db,
      { siteUrl: "https://example.com", nonHtmlPolicy: { enabled: true } } as any,
      [dummyPlugin],
      9224,
    );

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    await worker.processJob();

    const job = db.prepare("SELECT * FROM queue WHERE run_id = 'run2'").get() as any;
    expect(job.status).toBe("skipped_non_html");

    const result = db.prepare("SELECT * FROM results WHERE run_id = 'run2'").get() as any;
    expect(result).toBeUndefined();

    await worker.stop();
    exitSpy.mockRestore();
  });

  // Phase 4: Document audit lane tests
  it("runs document audit when auditDocuments is enabled", async () => {
    const db = getDb(":memory:");
    initializeSchema(db);

    db.exec("INSERT INTO runs (id, started_at, config_hash) VALUES ('run3', 'now', 'hash')");
    insertJob(db, {
      run_id: "run3",
      url: "https://example.com/files/document.pdf",
      depth: 0,
      resource_type: "document",
      audit_disposition: "auditable_document",
      source: "crawl",
      discovered_from: "https://example.com/home",
    });

    let documentPluginCalled = false;
    const documentPlugin: AuditPlugin = {
      name: "doc-analyzer",
      targets: ["document"],
      async run(ctx) {
        documentPluginCalled = true;
        // Verify context is DocumentAuditContext (does not have page property)
        expect((ctx as any).page).toBeUndefined();
        expect((ctx as any).contentType).toBe("application/pdf");
        ctx.results.custom_data = { documentAnalyzed: true };
      },
    };

    const worker = new AuditWorker(
      "audit-3",
      db,
      {
        siteUrl: "https://example.com",
        phases: { global: ["doc-analyzer"] },
        nonHtmlPolicy: { enabled: true, auditHtmlOnly: false, auditDocuments: true },
      } as any,
      [documentPlugin],
      9225,
    );

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    await worker.processJob();

    expect(documentPluginCalled).toBe(true);

    const job = db.prepare("SELECT * FROM queue WHERE run_id = 'run3'").get() as any;
    expect(job.status).toBe("completed");

    const result = db.prepare("SELECT * FROM results WHERE run_id = 'run3'").get() as any;
    expect(result).toBeDefined();
    const customData = JSON.parse(result.custom_data);
    expect(customData.documentAnalyzed).toBe(true);

    await worker.stop();
    exitSpy.mockRestore();
  });

  it("skips document audit when auditDocuments is disabled", async () => {
    const db = getDb(":memory:");
    initializeSchema(db);

    db.exec("INSERT INTO runs (id, started_at, config_hash) VALUES ('run4', 'now', 'hash')");
    insertJob(db, {
      run_id: "run4",
      url: "https://example.com/files/document.pdf",
      depth: 0,
      resource_type: "document",
      audit_disposition: "auditable_document",
      source: "crawl",
      discovered_from: "https://example.com/home",
    });

    const documentPlugin: AuditPlugin = {
      name: "doc-analyzer",
      targets: ["document"],
      async run() {
        throw new Error("should not run");
      },
    };

    const worker = new AuditWorker(
      "audit-4",
      db,
      {
        siteUrl: "https://example.com",
        phases: { global: ["doc-analyzer"] },
        nonHtmlPolicy: { enabled: true, auditHtmlOnly: true, auditDocuments: false },
      } as any,
      [documentPlugin],
      9226,
    );

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    await worker.processJob();

    const job = db.prepare("SELECT * FROM queue WHERE run_id = 'run4'").get() as any;
    expect(job.status).toBe("skipped_non_html");

    const result = db.prepare("SELECT * FROM results WHERE run_id = 'run4'").get() as any;
    expect(result).toBeUndefined();

    await worker.stop();
    exitSpy.mockRestore();
  });
});
