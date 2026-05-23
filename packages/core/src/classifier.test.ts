import { describe, it, expect, vi } from "vitest";
import { PageClassifier } from "./classifier.js";
import { ScannerConfig } from "@scanner/types";
import { Page } from "playwright";

describe("PageClassifier", () => {
    // Mock config
    const config = {
        siteUrl: "https://example.com",
        definitions: {
            "product": {
                selector: ".product-price",
                urlPattern: "/p/"
            },
            "article": {
                urlPattern: "/blog/"
            },
            "excluded-type": {
                urlPattern: "/hidden/",
                excludePattern: "skip-me"
            }
        },
        maxDepth: 3
    } as unknown as ScannerConfig;

    const classifier = new PageClassifier(config);

    // Helper to mock page.$
    const mockPage = (foundSelectors: string[] = []): Page => {
        return {
            $: vi.fn().mockImplementation(async (sel: string) => {
                return foundSelectors.includes(sel) ? {} : null;
            })
        } as unknown as Page;
    };

    it("always returns global", async () => {
        const types = await classifier.classify("https://example.com", mockPage());
        expect(types).toContain("global");
    });

    it("matches by selector", async () => {
        const page = mockPage([".product-price"]);
        const types = await classifier.classify("https://example.com/p/123", page);
        expect(types).toContain("product");
    });

    it("matches by URL pattern when selector fails", async () => {
        const page = mockPage([]); // No selector match
        const types = await classifier.classify("https://example.com/p/123", page);
        expect(types).toContain("product");
    });

    it("matches multiple types", async () => {
        // Assume article matches by URL, product matches by selector (unlikely but possible logic test)
        const page = mockPage([".product-price"]);
        const types = await classifier.classify("https://example.com/blog/p/123", page);

        expect(types).toContain("product"); // matched by selector
        expect(types).toContain("article"); // matched by URL pattern
    });

    it("respects excludePattern", async () => {
        // Matches urlPattern but also matches excludePattern
        const page = mockPage([]);
        const types = await classifier.classify("https://example.com/hidden/skip-me", page);
        expect(types).not.toContain("excluded-type");
    });

    it("handles invalid regex gracefully", async () => {
        // Bad regex in config shouldn't crash
        const badConfig = {
            siteUrl: "https://example.com",
            definitions: {
                "bad": { urlPattern: "[" }
            },
            maxDepth: 3
        } as unknown as ScannerConfig;
        const badClassifier = new PageClassifier(badConfig);
        const types = await badClassifier.classify("https://example.com", mockPage());
        expect(types).toEqual(["global"]);
    });
});
