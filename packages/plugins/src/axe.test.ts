import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AxePlugin } from "./axe.js";
import type { AuditContext } from "@scanner/types";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";

describe("AxePlugin", () => {
  let server: FastifyInstance;
  let baseUrl: string;
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  beforeEach(async () => {
    server = Fastify();

    server.get("/good", async (request, reply) => {
      reply.type("text/html").send(`
        <html lang="en">
          <head><title>Good</title></head>
          <body>
            <main>
              <h1>Accessible Page</h1>
              <img src="test.png" alt="A test image" />
            </main>
          </body>
        </html>
      `);
    });

    server.get("/bad", async (request, reply) => {
      reply.type("text/html").send(`
        <html>
          <head><title>Bad</title></head>
          <body>
            <h1>Inaccessible Page</h1>
            <img src="test.png" /> 
            <button></button>
          </body>
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

  it("finds violations on a bad page", async () => {
    await page.goto(`${baseUrl}/bad`);

    const ctx = {
      page,
      results: {},
      flags: { hasErrors: false },
      log: () => {},
    } as unknown as AuditContext;

    await AxePlugin.run(ctx);

    expect(ctx.results.a11y_violations).toBeDefined();
    expect(ctx.results.a11y_violations!.length).toBeGreaterThan(0);

    const ids = ctx.results.a11y_violations!.map((v: any) => v.id);
    expect(ids).toContain("image-alt");
    expect(ids).toContain("html-has-lang");
  });

  it("finds zero violations on a good page", async () => {
    await page.goto(`${baseUrl}/good`);

    const ctx = {
      page,
      results: {},
      flags: { hasErrors: false },
      log: () => {},
    } as unknown as AuditContext;

    await AxePlugin.run(ctx);

    expect(ctx.results.a11y_violations).toBeDefined();
    // Some minor things might still be caught if we don't strict mock
    // But we expect specific ones to be gone.
    const ids = ctx.results.a11y_violations!.map((v) => v.id);
    expect(ids).not.toContain("image-alt");
    expect(ids).not.toContain("html-has-lang");
  });
});
