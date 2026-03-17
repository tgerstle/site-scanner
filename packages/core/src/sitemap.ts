import { XMLParser } from "fast-xml-parser";
import { normalizeUrl } from "./url-utils.js";
import { logEvent } from "./logger.js";

const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_"
});

/**
 * Fetches and parses a sitemap (or sitemap index), returning a list of unique URLs.
 * Handles recursion for sitemap indexes.
 */
export async function fetchSitemapUrls(sitemapUrl: string, depth = 0): Promise<string[]> {
    if (depth > 3) {
        logEvent({ event: "sitemap_warning", severity: "warn", message: `Sitemap recursion depth exceeded at ${sitemapUrl}` });
        return [];
    }

    try {
        logEvent({ event: "sitemap_fetch", severity: "info", message: `Fetching sitemap: ${sitemapUrl}` });
        const response = await fetch(sitemapUrl, {
            headers: {
                "User-Agent": "Scanner/1.0 (Audit Bot)"
            }
        });

        if (!response.ok) {
            logEvent({ event: "sitemap_error", severity: "error", message: `Failed to fetch sitemap ${sitemapUrl}: ${response.statusText}` });
            return [];
        }

        const xmlContent = await response.text();
        const parsed = xmlParser.parse(xmlContent);

        const urls: Set<string> = new Set();

        // Check for Sitemap Index
        if (parsed.sitemapindex && parsed.sitemapindex.sitemap) {
            const sitemaps = Array.isArray(parsed.sitemapindex.sitemap)
                ? parsed.sitemapindex.sitemap
                : [parsed.sitemapindex.sitemap];

            logEvent({ event: "sitemap_info", severity: "info", message: `Found sitemap index with ${sitemaps.length} entries` });

            for (const entry of sitemaps) {
                if (entry.loc) {
                    const childUrls = await fetchSitemapUrls(entry.loc, depth + 1);
                    childUrls.forEach(u => urls.add(u));
                }
            }
        }
        // Check for Standard UrlSet
        else if (parsed.urlset && parsed.urlset.url) {
            const entries = Array.isArray(parsed.urlset.url)
                ? parsed.urlset.url
                : [parsed.urlset.url];

            logEvent({ event: "sitemap_info", severity: "info", message: `Found urlset with ${entries.length} URLs` });

            for (const entry of entries) {
                if (entry.loc) {
                    // Normalize before adding
                    const normalized = normalizeUrl(entry.loc, {
                        stripParams: ["utm_source", "utm_medium", "ref"], // Basic defaults
                        removeFragment: true
                    });
                    urls.add(normalized);
                }
            }
        } else {
            logEvent({ event: "sitemap_warning", severity: "warn", message: `Unknown sitemap format at ${sitemapUrl}` });
        }

        return Array.from(urls);

    } catch (error: any) {
        logEvent({ event: "sitemap_error", severity: "error", message: `Error parsing sitemap ${sitemapUrl}: ${error.message}` });
        return [];
    }
}
