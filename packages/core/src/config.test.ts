import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import * as fs from "node:fs";
import { loadConfig } from "./config.js";
import { ScannerConfigSchema } from "@scanner/types";

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
        // Verify default value
        expect(config.phases?.global).toContain("seo-tech");
    });
});
