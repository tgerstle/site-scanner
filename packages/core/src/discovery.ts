import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type { LinkFilterOptions, ScannerConfig } from "@scanner/types";

const ASSET_BLOCK_GLOB = "**/*.{png,jpg,jpeg,gif,svg,css,woff,woff2,mp4,webm}";

/**
 * Launch the audit browser. ALWAYS exposes --remote-debugging-port so the Lighthouse
 * plugin can attach over CDP (auditing fidelity beats stealth). When config.stealth is
 * on, adds automation-signal masking flags.
 */
/**
 * Pure builder for the audit browser's launch args. Extracted so it can be unit-tested
 * without spawning Chromium. The CDP port is ALWAYS present (Lighthouse depends on it);
 * stealth masking flags are added only when config.stealth is on.
 */
export function buildAuditLaunchArgs(cdpPort: number, config: Pick<ScannerConfig, "stealth">): string[] {
  const args = [
    `--remote-debugging-port=${cdpPort}`, // REQUIRED for Lighthouse — never drop this
    "--disable-gpu",
    "--disable-dev-shm-usage",
  ];
  if (config.stealth) {
    args.push("--disable-blink-features=AutomationControlled");
    // NOT --no-sandbox by default: only add in a container that requires it.
  }
  return args;
}

export async function launchAuditBrowser(cdpPort: number, config: ScannerConfig): Promise<Browser> {
  return chromium.launch({ headless: true, args: buildAuditLaunchArgs(cdpPort, config) });
}

/**
 * Single canonical context builder. Applies identity settings (UA/viewport/locale/tz/proxy)
 * consistently. `blockAssets` is an explicit CALLER argument (decoupled from config.blockAssets)
 * so the audit lane can force it false regardless of user config.
 */
export async function createStandardContext(
  browser: Browser,
  config: ScannerConfig,
  blockAssets: boolean,
): Promise<{ browser: Browser; context: BrowserContext }> {
  const context = await browser.newContext({
    userAgent: config.userAgent,
    viewport: config.viewport,
    deviceScaleFactor: 1,
    locale: config.locale,
    timezoneId: config.timezoneId,
    proxy: config.proxy,
  });

  if (blockAssets) {
    await context.route(ASSET_BLOCK_GLOB, (route) => route.abort());
  }

  return { browser, context };
}

/**
 * Discovery-lane fast context: plain launch + asset blocking honoring config.blockAssets.
 * Used by the CLI `classify` command. A minimal config is synthesized when none is given.
 */
export async function setupFastContext(
  config?: ScannerConfig,
): Promise<{ browser: Browser; context: BrowserContext }> {
  const browser = await chromium.launch({
    args: ["--disable-gpu", "--disable-dev-shm-usage"],
  });

  const context = await browser.newContext(
    config
      ? {
          userAgent: config.userAgent,
          viewport: config.viewport,
          deviceScaleFactor: 1,
          locale: config.locale,
          timezoneId: config.timezoneId,
          proxy: config.proxy,
        }
      : {},
  );

  // Block heavy assets for speed (discovery lane default).
  if (!config || config.blockAssets) {
    await context.route(ASSET_BLOCK_GLOB, (route) => route.abort());
  }

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

/**
 * Extract all anchor hrefs from an already-loaded page. Shared by the consolidated
 * audit worker (which discovers inline) and the classify path. The caller owns the
 * page lifecycle and navigation.
 */
export async function discoverLinks(page: Page): Promise<string[]> {
  return page.$$eval("a", (anchors) =>
    anchors.map((a) => (a as HTMLAnchorElement).href).filter(Boolean),
  );
}
