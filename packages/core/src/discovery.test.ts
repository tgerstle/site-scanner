import { describe, expect, it } from "vitest";
import { filterLinks, buildAuditLaunchArgs } from "./discovery.js";

describe("buildAuditLaunchArgs", () => {
  it("always includes the CDP remote-debugging port (Lighthouse dependency)", () => {
    const args = buildAuditLaunchArgs(9321, { stealth: false });
    expect(args).toContain("--remote-debugging-port=9321");
  });

  it("adds automation-masking flag only when stealth is on", () => {
    expect(buildAuditLaunchArgs(9222, { stealth: false })).not.toContain(
      "--disable-blink-features=AutomationControlled",
    );
    const stealthArgs = buildAuditLaunchArgs(9222, { stealth: true });
    expect(stealthArgs).toContain("--disable-blink-features=AutomationControlled");
    // Even with stealth, the CDP port must survive.
    expect(stealthArgs).toContain("--remote-debugging-port=9222");
  });

  it("never adds --no-sandbox by default", () => {
    expect(buildAuditLaunchArgs(9222, { stealth: true })).not.toContain("--no-sandbox");
  });
});

describe("filterLinks", () => {
  it("filters out non-matching domains", () => {
    const links = ["https://example.com/page1", "https://other.com/page2", "/page3"];

    const result = filterLinks(links, { baseUrl: "https://example.com" });
    expect(result).toEqual(["https://example.com/page1", "https://example.com/page3"]);
  });

  it("removes fragments", () => {
    const links = ["https://example.com/page1#section1", "https://example.com/page2#section2"];

    const result = filterLinks(links, { baseUrl: "https://example.com" });
    expect(result).toEqual(["https://example.com/page1", "https://example.com/page2"]);
  });

  it("respects include paths", () => {
    const links = ["https://example.com/blog/post1", "https://example.com/about"];

    const result = filterLinks(links, {
      baseUrl: "https://example.com",
      includePaths: ["/blog"],
    });
    expect(result).toEqual(["https://example.com/blog/post1"]);
  });

  it("respects exclude paths", () => {
    const links = ["https://example.com/blog/post1", "https://example.com/admin/login"];

    const result = filterLinks(links, {
      baseUrl: "https://example.com",
      excludePaths: ["/admin"],
    });
    expect(result).toEqual(["https://example.com/blog/post1"]);
  });
});
