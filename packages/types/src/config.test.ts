import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import * as fs from "node:fs";
import { ScannerConfigSchema, loadConfig } from "./config.js";

describe("Configuration Schema", () => {
  it("parses minimal valid config with defaults", () => {
    const config = ScannerConfigSchema.parse({ siteUrl: "https://example.com" });
    expect(config.siteUrl).toBe("https://example.com");
    expect(config.maxDepth).toBe(3);
    expect(config.plugins).toEqual(["axe", "lighthouse"]);
  });

  it("rejects invalid URLs", () => {
    expect(() => ScannerConfigSchema.parse({ siteUrl: "not-a-url" })).toThrow();
  });

  it("loads from partial config object (overrides)", () => {
    const config = loadConfig(undefined, { siteUrl: "https://foo.com", maxDepth: 10 });
    expect(config.maxDepth).toBe(10);
    expect(config.outputDir).toBe("./artifacts");
  });

  it("loads and merges config from file", () => {
    const testConfigPath = resolve(__dirname, "../awaconfig.test.json");
    fs.writeFileSync(
      testConfigPath,
      JSON.stringify({ siteUrl: "https://file.com", outputFormat: "json" }),
    );

    try {
      // overrides should beat file
      const config = loadConfig(testConfigPath, { siteUrl: "https://cli.com" });
      expect(config.siteUrl).toBe("https://cli.com");
      expect(config.outputFormat).toBe("json");
    } finally {
      fs.unlinkSync(testConfigPath);
    }
  });
});
