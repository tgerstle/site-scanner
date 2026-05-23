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
      } as any,
      [dummyPlugin],
      9223,
    ); // Use a different port to avoid conflicts

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    await worker.processJob(); // Should pick up the job and run dummyPlugin

    const job = db.prepare("SELECT * FROM queue WHERE depth = 0").get() as any;
    expect(job.status).toBe("done");

    const result = db.prepare("SELECT * FROM results WHERE run_id = 'run1'").get() as any;
    expect(result).toBeDefined();
    expect(result.seo_score).toBe(99);
    expect(JSON.parse(result.custom_data)).toEqual({ testData: "hello" });

    await worker.stop();
    exitSpy.mockRestore();
  }, 15000);
});
