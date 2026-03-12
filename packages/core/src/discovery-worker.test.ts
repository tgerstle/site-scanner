import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { getDb, initializeSchema, insertJob } from "db";
import { setupFastContext, filterLinks, discoverLinks } from "./discovery.js";
import { DiscoveryWorker } from "./discovery-worker.js";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";

describe("DiscoveryWorker and Playwright", () => {
  let server: FastifyInstance;
  let baseUrl: string;

  beforeEach(async () => {
    server = Fastify();

    server.get("/", async (request, reply) => {
      reply.type("text/html").send(`
        <html>
          <body>
            <a href="/page1">Page 1</a>
            <a href="/page2">Page 2</a>
            <a href="https://external.com">External</a>
            <img src="/heavy.png" />
          </body>
        </html>
      `);
    });

    server.get("/page1", async (request, reply) => {
      reply.type("text/html").send(`
        <html>
          <body>
            <a href="/">Home</a>
          </body>
        </html>
      `);
    });

    server.get("/heavy.png", async (request, reply) => {
      // Simulate heavy image
      reply.type("image/png").send("fake image data");
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

  it("extracts valid links and filters external ones", async () => {
    const { browser, context } = await setupFastContext();
    try {
      const links = await discoverLinks(baseUrl, context);

      const filtered = filterLinks(links, { baseUrl });

      expect(filtered).toContain(`${baseUrl}/page1`);
      expect(filtered).toContain(`${baseUrl}/page2`);
      expect(filtered).not.toContain("https://external.com");
    } finally {
      await browser.close();
    }
  });

  it("processes a job, discovers links, and queues them", async () => {
    const db = getDb(":memory:");
    initializeSchema(db);

    // Seed initial run and job
    db.exec("INSERT INTO runs (id, started_at, config_hash) VALUES ('run1', 'now', 'hash')");
    insertJob(db, { run_id: "run1", url: baseUrl, depth: 0 });

    const worker = new DiscoveryWorker("test-worker", db, {
      siteUrl: baseUrl,
      maxDepth: 1,
    } as any);

    await worker.processJob(); // Should pick up baseUrl

    // Check what got inserted into the queue
    const queuedJobs = db.prepare("SELECT * FROM queue WHERE depth = 1").all() as any[];

    expect(queuedJobs.length).toBe(2);
    const urls = queuedJobs.map((j) => j.url);
    expect(urls).toContain(`${baseUrl}/page1`);
    expect(urls).toContain(`${baseUrl}/page2`);

    const rootJob = db.prepare("SELECT * FROM queue WHERE depth = 0").get() as any;
    expect(rootJob.status).toBe("done");

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    await worker.stop();
    exitSpy.mockRestore();
  });
});
