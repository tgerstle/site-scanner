import { describe, it, expect, vi } from "vitest";
import { runPipeline } from "./pipeline.js";
import type { AuditContext, AuditPlugin } from "@scanner/types";

describe("runPipeline", () => {
  it("executes plugins in order", async () => {
    const order: string[] = [];

    const plugin1: AuditPlugin = {
      name: "p1",
      run: async () => {
        order.push("p1");
      },
    };

    const plugin2: AuditPlugin = {
      name: "p2",
      run: async () => {
        order.push("p2");
      },
    };

    const ctx = {
      flags: { hasErrors: false },
      log: vi.fn(),
      results: {},
    } as unknown as AuditContext;

    await runPipeline(ctx, [plugin1, plugin2]);
    expect(order).toEqual(["p1", "p2"]);
    expect(ctx.flags.hasErrors).toBe(false);
  });

  it("gracefully handles plugin errors without crashing", async () => {
    const plugin1: AuditPlugin = {
      name: "faulty",
      run: async () => {
        throw new Error("Oops");
      },
    };

    const plugin2: AuditPlugin = {
      name: "good",
      run: async (ctx) => {
        ctx.results.seo_score = 100;
      },
    };

    const logFn = vi.fn();
    const ctx = {
      flags: { hasErrors: false },
      log: logFn,
      results: {},
    } as unknown as AuditContext;

    await runPipeline(ctx, [plugin1, plugin2]);

    expect(ctx.flags.hasErrors).toBe(true);
    expect(logFn).toHaveBeenCalledWith(expect.stringContaining("Plugin faulty failed"));
    expect(ctx.results.seo_score).toBe(100); // 2nd plugin still runs
  });
});
