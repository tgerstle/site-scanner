import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import * as fs from "node:fs";
import { loadConfig } from "./config.js";
import { ScannerConfigSchema, DEFAULT_DESKTOP_UA } from "@scanner/types";

describe("ScannerConfig — politeness & stealth fields", () => {
  const base = { siteUrl: "https://example.com" };

  it("applies defaults for the new fields", () => {
    const c = ScannerConfigSchema.parse(base);
    expect(c.concurrency).toBe(2);
    expect(c.throttleMs).toBe(5000);
    expect(c.throttleJitter).toBe(10);
    expect(c.stealth).toBe(false);
    expect(c.blockAssets).toBe(true);
    expect(c.humanize).toBe(false);
    expect(c.locale).toBe("en-US");
    expect(c.viewport).toEqual({ width: 1920, height: 1080 });
  });

  it("defaults userAgent to a realistic UA with no HeadlessChrome token", () => {
    const c = ScannerConfigSchema.parse(base);
    expect(c.userAgent).toBe(DEFAULT_DESKTOP_UA);
    expect(c.userAgent.toLowerCase()).not.toContain("headless");
  });

  it("rejects invalid values", () => {
    expect(() => ScannerConfigSchema.parse({ ...base, concurrency: 0 })).toThrow();
    expect(() => ScannerConfigSchema.parse({ ...base, throttleMs: -1 })).toThrow();
    expect(() => ScannerConfigSchema.parse({ ...base, throttleJitter: 150 })).toThrow();
  });

  it("accepts a proxy object", () => {
    const c = ScannerConfigSchema.parse({ ...base, proxy: { server: "http://p:3128" } });
    expect(c.proxy?.server).toBe("http://p:3128");
  });
});

describe("Configuration Loading", () => {
    it("loads from partial config object (overrides)", () => {
        // siteUrl is required
        const config = loadConfig(undefined, { siteUrl: "https://foo.com", maxDepth: 10 });
        expect(config.siteUrl).toBe("https://foo.com");
        expect(config.maxDepth).toBe(10);
        // Inherits default outputDir
        expect(config.outputDir).toBe("./artifacts");
    });

    it("loads and merges config from file", () => {
        const testConfigPath = resolve(__dirname, "awaconfig.test.json");
        fs.writeFileSync(
            testConfigPath,
            JSON.stringify({ siteUrl: "https://file.com", outputFormat: "json" }),
        );

        try {
            // overrides should beat file for siteUrl
            // file should beat defaults for outputFormat
            const config = loadConfig(testConfigPath, { siteUrl: "https://cli.com" });

            expect(config.siteUrl).toBe("https://cli.com");
            expect(config.outputFormat).toBe("json");
            expect(config.maxDepth).toBe(3); // Default
        } finally {
            if (fs.existsSync(testConfigPath)) {
                fs.unlinkSync(testConfigPath);
            }
        }
    });

    it("merges defaults deep", () => {
        // Rely on DEFAULT_CONFIG providing 'phases.global'
        const config = loadConfig(undefined, { siteUrl: "https://merge.com" });
        expect(config.phases?.global).toBeDefined();
        // Verify default value (DEFAULT_CONFIG.phases.global)
        expect(config.phases?.global).toContain("lighthouse");
    });
});
