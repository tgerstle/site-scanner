import { describe, expect, it } from "vitest";
import { filterLinks } from "./discovery.js";

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
