import { z } from "zod";

/**
 * Defines a rule to identify a specific page type (e.g., "Product", "Article").
 */
export const PageDefinitionSchema = z.object({
    /**
     * Optional: Schema.org @type to match in JSON-LD.
     * HIGHEST PRECEDENCE.
     * Can be a single string or array of strings (e.g. ["Article", "BlogPosting"])
     */
    schemaType: z.union([z.string(), z.array(z.string())]).optional(),

    /**
     * CSS selector or text content to identify this page type.
     * HIGHER PRECEDENCE than urlPattern.
     * Example: "script[type='application/ld+json']:contains('Product')"
     */
    selector: z.string().optional(),

    /**
     * Regex pattern to match the URL.
     * LOWER PRECEDENCE than selector.
     * Example: "/products?/"
     */
    urlPattern: z.string().optional(),

    /**
     * Optional: Patterns to explicitly exclude from this type.
     */
    excludePattern: z.string().optional(),
});

export type PageDefinition = z.infer<typeof PageDefinitionSchema>;

/**
 * Configuration for a specific plugin execution within a phase.
 */
export const PluginConfigObjSchema = z.object({
    name: z.string(),
    /**
     * Optional configuration passed to the plugin instance.
     * Allows control over severity (e.g., "only critical"), standards, etc.
     */
    options: z.record(z.any()).optional(),
    /**
     * Overrides the default group for logging (e.g., "seo", "security")
     */
    group: z.string().optional(),
});

export type PluginConfigObj = z.infer<typeof PluginConfigObjSchema>;

/**
 * Discovery configuration settings.
 */
export const DiscoveryConfigSchema = z.object({
    /**
     * "crawl" = Follow links (default)
     * "sitemap" = Use sitemap only
     * "hybrid" = Use sitemap + crawl
     */
    mode: z.enum(["crawl", "sitemap", "hybrid"]).default("crawl"),

    /**
     * Explicit path to sitemap. If not provided, we try standard locations.
     */
    sitemapUrl: z.string().optional(),

    /**
     * Mobile user agent emulation for discovery?
     */
    mobile: z.boolean().default(false),
});

export type DiscoveryConfig = z.infer<typeof DiscoveryConfigSchema>;

export const ScannerConfigSchema = z.object({
    siteUrl: z.string().url(),

    maxDepth: z.number().min(0).default(3),

    /**
     * Optional: Wait for network idle before classification/auditing.
     * Default: 5000 (0 to disable wait)
     */
    networkIdleTimeout: z.number().min(0).optional().default(5000),

    includePaths: z.array(z.string()).optional(),
    excludePaths: z.array(z.string()).optional(),

    /**
     * Discovery settings (new structure).
     */
    discovery: DiscoveryConfigSchema.default({ mode: "crawl", mobile: false }),

    /**
     * Defines how to identify a page type.
     * Key = Page Type ID (e.g., "product", "blog")
     */
    definitions: z.record(PageDefinitionSchema).optional(),

    /**
     * Maps a Page Type to a list of plugins to execute.
     * Key = Page Type ID
     * Value = Array of plugin names OR config objects.
     * Example: ["seo-tech", { name: "axe", options: { tags: ["wcag2a"] } }]
     */
    phases: z.record(z.array(z.union([z.string(), PluginConfigObjSchema]))).optional(),

    /**
     * If true, the system uses the internal default configuration
     * as a base and merges the user config on top.
     * Default: true
     */
    useDefaults: z.boolean().default(true),

    // Legacy support (to be deprecated or mapped to 'global' phase)
    plugins: z.array(z.string()).optional(),
    outputFormat: z.enum(["json", "sqlite", "both"]).default("sqlite"),
    outputDir: z.string().default("./artifacts"),
});

export type ScannerConfig = z.infer<typeof ScannerConfigSchema>;
