import { describe, expect, it } from "vitest";
import { assignAuditDisposition, inferResourceType, triageResource } from "./resource-triage.js";

describe("resource triage", () => {
    it("classifies html URLs as html", () => {
        expect(inferResourceType("https://example.com/page.html")).toBe("html");
        expect(assignAuditDisposition("html")).toBe("auditable_html");
    });

    it("classifies documents and media URLs", () => {
        expect(inferResourceType("https://example.com/files/guide.pdf")).toBe("document");
        expect(inferResourceType("https://example.com/images/hero.jpg")).toBe("media");
    });

    it("triages unknown and binary URLs consistently", () => {
        expect(triageResource("https://example.com/page")).toEqual({
            resourceType: "unknown",
            auditDisposition: "auditable_html",
            skipReason: null,
        });

        expect(triageResource("https://example.com/archive.zip")).toEqual({
            resourceType: "binary",
            auditDisposition: "inventory_only",
            skipReason: "non_html_binary",
        });
    });
});