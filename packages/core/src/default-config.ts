// packages/core/src/default-config.ts
import { ScannerConfig } from "@scanner/types";

/**
 * The built-in default configuration for the cascading runner.
 * Provides sensible defaults for common e-commerce and content sites.
 */
// @ts-ignore - Partial<ScannerConfig> is valid but TS might complain about optional fields
export const DEFAULT_CONFIG: Partial<ScannerConfig> = {
    networkIdleTimeout: 5000,
    definitions: {
        "product": {
            schemaType: "Product",
            // Using a mix of CSS selectors. Constraint: :contains is not standard CSS.
            // We'll rely on class names and form actions for now.
            // If we really need JSON-LD check, we should use a custom extractor or XPath.
            selector: ".product-price, form[action*='/cart/add'], [itemtype*='schema.org/Product']",
            urlPattern: "/(product|products|item|items|p|shop)/",
        },
        "article": {
            schemaType: ["Article", "BlogPosting", "NewsArticle", "TechArticle"],
            selector: "article.post, .blog-post, [itemtype*='schema.org/Article'], [itemtype*='schema.org/BlogPosting']",
            urlPattern: "/(blog|news|article|articles|post|posts)/",
        },
        "category": {
            selector: ".product-grid, .collection-list",
            urlPattern: "/(category|categories|collection|collections|c)/"
        },
        "cart": {
            urlPattern: "/(cart|checkout|basket)/",
        },
    },
    phases: {
        "global": ["lighthouse"],

        "product": [
            { name: "axe", options: { rules: ["color-contrast", "button-name"] } },
        ],

        "article": [
            "axe",
        ],

        "cart": [],
    },
};
