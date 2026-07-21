import { z } from "zod";

/**
 * Realistic desktop UA used when stealth is on and no explicit userAgent is set.
 * Avoids Playwright's default "HeadlessChrome" token, the most obvious automation tell.
 */
export const DEFAULT_DESKTOP_UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

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

/**
 * Phase 4: Non-HTML resource audit policy.
 */
export const NonHtmlPolicySchema = z.object({
    /**
     * Phase 5: Master flag to enable/disable two-track model.
     * Default: false (legacy behavior stays enabled initially)
     * Set to true to activate resource triage, inventory, and gating.
     */
    enabled: z.boolean().default(false),
    auditHtmlOnly: z.boolean().default(true),
    auditDocuments: z.boolean().default(false),
    documentContentTypes: z.array(z.string()).default(["application/pdf"]),
}).optional();

export type NonHtmlPolicy = z.infer<typeof NonHtmlPolicySchema>;

export const ScannerConfigSchema = z.object({
    siteUrl: z.string().url(),

    maxDepth: z.number().min(0).default(3),

    /**
     * Number of parallel audit workers to spawn.
     * Lowering this is the most effective way to reduce load on the target site.
     */
    concurrency: z.number().min(1).default(2),

    /**
     * Politeness delay (ms) between job completions within a single worker.
     * Only applies between actual page loads; an empty queue polls at a fixed idle floor.
     */
    throttleMs: z.number().min(0).default(5000),

    /**
     * Randomized jitter (percentage, 0-100) applied to throttleMs to look less robotic.
     * e.g. 10 => throttleMs +/- 10%.
     */
    throttleJitter: z.number().min(0).max(100).default(10),

    /**
     * Stealth / anti-detection settings.
     * `stealth` toggles launch-flag masking; identity fields below always apply.
     */
    stealth: z.boolean().default(false),

    /**
     * Browser User-Agent. Defaults to a realistic desktop UA (never undefined) so stealth
     * mode does not leak "HeadlessChrome". Set explicitly for a bot-honest string.
     */
    userAgent: z.string().default(DEFAULT_DESKTOP_UA),

    /** Viewport. Single source of truth (schema-defaulted); code reads config.viewport directly. */
    viewport: z.object({
        width: z.number().default(1920),
        height: z.number().default(1080),
    }).default({ width: 1920, height: 1080 }),

    locale: z.string().default("en-US"),
    timezoneId: z.string().optional(), // e.g. "America/New_York"

    proxy: z.object({
        server: z.string(),
        username: z.string().optional(),
        password: z.string().optional(),
    }).optional(),

    /**
     * Discovery-lane asset blocking (speed). The audit lane always loads assets
     * (Lighthouse/CWV + axe require a rendered page) and ignores this flag.
     */
    blockAssets: z.boolean().default(true),

    /** Opt-in behavioral realism: randomized delays before interactions. */
    humanize: z.boolean().default(false),

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

    /**
     * Phase 4/5: Non-HTML resource policy (two-track model: triage + gating).
     * Flat shape shared with NonHtmlPolicySchema. Optional for gradual rollout.
     */
    nonHtmlPolicy: NonHtmlPolicySchema,
});

    export type ScannerConfig = z.infer<typeof ScannerConfigSchema>;
