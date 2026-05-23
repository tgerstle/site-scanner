import { AuditContext, AuditPlugin, SeoResult } from "@scanner/types";
import { SeoValidator } from "./seo-validator.js";

export const SeoMetadataPlugin: AuditPlugin = {
    name: "seo-metadata",
    async run(ctx: AuditContext) {
        ctx.log("Starting SEO Metadata extraction...");

        const seoData = await ctx.page.evaluate((): Omit<SeoResult, "validation"> => {
            // Helper to safely get content or attribute
            const getMetaContent = (name: string): string | null => {
                const el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
                return el ? (el.getAttribute("content") || null) : null;
            };

            const getElementAttribute = (selector: string, attr: string): string | null => {
                const el = document.querySelector(selector);
                return el ? (el.getAttribute(attr) || null) : null;
            };

            // 1. Standard Meta Tags
            const meta = {
                title: document.title || null,
                description: getMetaContent("description"),
                keywords: getMetaContent("keywords"), // Still sometimes used
                canonical: getElementAttribute("link[rel='canonical']", "href"),
                robots: getMetaContent("robots"),
                viewport: getMetaContent("viewport"),
                charset: document.characterSet || document.charset,
                generator: getMetaContent("generator"),
            };

            // 2. Open Graph Keys
            const openGraph: Record<string, string> = {};
            document.querySelectorAll("meta[property^='og:']").forEach((el) => {
                const property = el.getAttribute("property");
                const content = el.getAttribute("content");
                if (property && content) {
                    openGraph[property] = content;
                }
            });

            // 3. Twitter Keys
            const twitter: Record<string, string> = {};
            document.querySelectorAll("meta[name^='twitter:']").forEach((el) => {
                const name = el.getAttribute("name");
                const content = el.getAttribute("content");
                if (name && content) {
                    twitter[name] = content;
                }
            });

            // 4. JSON-LD
            const jsonLd: Array<Record<string, any>> = [];
            document.querySelectorAll("script[type='application/ld+json']").forEach((el) => {
                try {
                    const content = el.textContent;
                    if (content) {
                        const parsed = JSON.parse(content);
                        // Handle array of objects in a single script tag
                        if (Array.isArray(parsed)) {
                            jsonLd.push(...parsed);
                        } else {
                            jsonLd.push(parsed);
                        }
                    }
                } catch (e) {
                    // Store minimal error info if possible, or just skip
                    jsonLd.push({ _error: "Invalid JSON-LD", raw: el.textContent?.substring(0, 100) });
                }
            });

            // 5. Heading Structure
            const headings: Array<{ level: number; text: string }> = [];
            document.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((el) => {
                const level = parseInt(el.tagName.substring(1), 10);
                headings.push({ level, text: (el.textContent || "").trim() });
            });

            // 6. Basic Images for SEO (Alt text check)
            // Limit to first 50 to avoid massive payloads on gallery pages
            const images: Array<{ src: string; alt: string; loading?: string }> = [];
            document.querySelectorAll("img").forEach((el, index) => {
                if (index > 50) return;
                images.push({
                    src: el.src,
                    alt: el.alt || "",
                    loading: el.loading
                });
            });

            return {
                meta,
                openGraph,
                twitter,
                jsonLd,
                headings,
                images
            };
        });

        const validation = SeoValidator.validate(seoData, ctx.url);
        ctx.log(`SEO Validation Score: ${validation.score}`);

        // Save to results
        ctx.results.seo_result = { ...seoData, validation };
        ctx.results.seo_score = validation.score;

        ctx.log(`Extracted SEO data: ${seoData.jsonLd.length} JSON-LD blocks, ${Object.keys(seoData.openGraph).length} OG tags.`);
    }
};
