import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CustomExtractorPlugin } from "./custom-extractor.js";
import type { AuditContext } from "@scanner/types";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";

describe("CustomExtractorPlugin", () => {
  let server: FastifyInstance;
  let baseUrl: string;
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  beforeEach(async () => {
    server = Fastify();

    server.get("/", async (request, reply) => {
      reply.type("text/html").send(`
        <html lang="fr">
          <head>
            <meta name="description" content="A test description" />
            <title>Test</title>
          </head>
          <body><h1>Test</h1></body>
        </html>
      `);
    });

    await server.listen({ port: 0 });
    const address = server.server.address();
    if (address && typeof address !== "string") {
      baseUrl = `http://localhost:${address.port}`;
    }

    browser = await chromium.launch();
    context = await browser.newContext();
    page = await context.newPage();
  });

  afterEach(async () => {
    await page.close();
    await context.close();
    await browser.close();
    await server.close();
  });

  it("extracts meta description and language", async () => {
    await page.goto(baseUrl);

    const ctx = {
      page,
      results: {},
      flags: { hasErrors: false },
      log: () => {},
    } as unknown as AuditContext;

    await CustomExtractorPlugin.run(ctx);

    expect(ctx.results.custom_data).toBeDefined();
    expect(ctx.results.custom_data!.metaDescription).toBe("A test description");
    expect(ctx.results.custom_data!.language).toBe("fr");
  });
});
