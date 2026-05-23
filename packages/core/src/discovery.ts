import { chromium, type Browser, type BrowserContext } from "playwright";
import type { LinkFilterOptions } from "@scanner/types";

export async function setupFastContext(): Promise<{ browser: Browser; context: BrowserContext }> {
  const browser = await chromium.launch({
    args: ["--disable-gpu", "--disable-dev-shm-usage"],
  });

  const context = await browser.newContext();

  // Block heavy assets for speed
  await context.route("**/*.{png,jpg,jpeg,gif,svg,css,woff,woff2,mp4,webm}", (route) =>
    route.abort(),
  );

  return { browser, context };
}

export function filterLinks(links: string[], options: LinkFilterOptions): string[] {
  const base = new URL(options.baseUrl);

  return links
    .map((link) => {
      try {
        return new URL(link, base.origin);
      } catch {
        return null;
      }
    })
    .filter((url): url is URL => url !== null)
    .filter((url) => url.hostname === base.hostname) // Stay on same domain
    .map((url) => {
      url.hash = ""; // Remove fragments
      return url.toString();
    })
    .filter((url) => {
      // Include / Exclude path logic
      const u = new URL(url);
      const path = u.pathname;

      let includeMatch = true;
      if (options.includePaths && options.includePaths.length > 0) {
        includeMatch = options.includePaths.some((p) => path.startsWith(p));
      }

      let excludeMatch = false;
      if (options.excludePaths && options.excludePaths.length > 0) {
        excludeMatch = options.excludePaths.some((p) => path.startsWith(p));
      }

      return includeMatch && !excludeMatch;
    })
    .filter((value, index, self) => self.indexOf(value) === index); // Deduplicate
}

export async function discoverLinks(url: string, context: BrowserContext): Promise<string[]> {
  const page = await context.newPage();
  try {
    // We only need the DOM to be ready
    await page.goto(url, { waitUntil: "domcontentloaded" });

    // Extract all href attributes
    const links = await page.$$eval("a", (anchors) =>
      anchors.map((a) => (a as HTMLAnchorElement).href),
    );
    return links;
  } finally {
    await page.close();
  }
}
