import { WorkerLoop } from "./worker-base.js";
import { runPipeline, type PluginExecutionConfig } from "./pipeline.js";
import { resolvePlugins } from "./plugin-resolver.js";
import { runScenario } from "./scenarios/index.js";
import { logEvent } from "./logger.js";
import { claimNextJob, updateJobStatus, saveAuditResult, insertJob } from "@scanner/db";
import type { Database } from "better-sqlite3";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type { ScannerConfig, AuditContext, AuditPlugin } from "@scanner/types";
import { PageClassifier } from "./classifier.js";
import { normalizeUrl } from "./url-utils.js";
import { filterLinks } from "./discovery.js";

// This will be dynamically loaded based on config, but for now we'll accept them in the constructor
export class AuditWorker extends WorkerLoop {
    private browser: Browser | null = null;
    private ctx: BrowserContext | null = null;
    private config: ScannerConfig;
    private db: Database;
    private pluginRegistry: Map<string, AuditPlugin>;
    private cdpPort: number;
    private classifier: PageClassifier;

    constructor(
        workerId: string,
        db: Database,
        config: ScannerConfig,
        plugins: AuditPlugin[],
        cdpPort: number = 9222,
    ) {
        super("audit", workerId);
        this.db = db;
        this.config = config;

        // Index plugins by name for fast lookup, support "axe" alias for "axe-core"
        this.pluginRegistry = new Map();
        plugins.forEach(p => {
            this.pluginRegistry.set(p.name, p);
            if (p.name === 'axe-core') {
                this.pluginRegistry.set('axe', p);
            }
        });

        this.classifier = new PageClassifier(config);

        // Assign a random port if default is used to avoid collisions
        this.cdpPort = cdpPort === 9222 ? 9222 + Math.floor(Math.random() * 500) : cdpPort;
        logEvent({
            event: "worker_init",
            severity: "info",
            message: `Worker ${workerId} initialized with CDP port ${this.cdpPort}`,
            workerId: this.workerId
        });
    }

    /**
     * Replaces the private resolvePluginsForTypes(types) method.
     */
    private resolvePluginsForTypes(types: string[]): PluginExecutionConfig[] {
        return resolvePlugins(this.pluginRegistry, this.config, types, (msg) => {
            logEvent({
                event: "worker_warning",
                severity: "warn",
                message: msg,
                workerId: this.workerId
            });
        });
    }

    async processJob(): Promise<void> {
        const job = claimNextJob(this.db, this.workerId, "audit");
        if (!job) {
            return;
        }

        if (!this.browser) {
            this.browser = await chromium.launch({
                args: [
                    `--remote-debugging-port=${this.cdpPort}`,
                    "--disable-gpu",
                    "--disable-dev-shm-usage",
                ],
            });
            this.ctx = await this.browser.newContext();
        }

        let page: Page | null = null;

        try {
            page = await this.ctx!.newPage();

            // Use domcontentloaded instead of networkidle to be more resilient to slow assets/analytics
            // Increase timeout to 60s
            // Store response to pass to classifier
            const response = await page.goto(job.url, { waitUntil: "domcontentloaded", timeout: 60000 });

            // --- LINK EXTRACTION (IMMEDIATE) ---
            // Move link extraction here to unblock the crawler queue asap.
            // We do this on the initial load state.
            const discoveryMode = this.config.discovery?.mode || "crawl";
            if (discoveryMode !== "sitemap" && job.depth < this.config.maxDepth) {
                try {
                    const rawLinks = await page.$$eval("a", (els) => els.map((el) => (el as HTMLAnchorElement).href).filter(Boolean));
                    const uniqueLinks = new Set<string>();
                    for (const raw of rawLinks) {
                        uniqueLinks.add(normalizeUrl(raw));
                    }
                    const filteredLinks = filterLinks(Array.from(uniqueLinks), {
                        baseUrl: this.config.siteUrl,
                        includePaths: this.config.includePaths,
                        excludePaths: this.config.excludePaths
                    });

                    if (filteredLinks.length > 0) {
                        const insertTx = this.db.transaction((urls: string[]) => {
                            for (const url of urls) {
                                insertJob(this.db, {
                                    run_id: job.run_id,
                                    url,
                                    depth: job.depth + 1,
                                    priority: 50
                                });
                            }
                        });
                        insertTx(filteredLinks);
                        logEvent({ event: "worker_info", severity: "info", message: `Extracted ${filteredLinks.length} new links immediately`, workerId: this.workerId });
                    }
                } catch (e: any) {
                    logEvent({ event: "worker_warning", severity: "warn", message: `Immediate link extraction failed: ${e.message}`, workerId: this.workerId });
                }
            }

            // --- CLASSIFICATION STEP ---
            // Optimistic approach: Try to classify immediately to speed up static pages.
            // If we don't find specific types, we wait for networkidle to allow dynamic content to load.
            let finalUrl = page.url();
            let { types: matchedTypes, meta: classificationMeta } = await this.classifier.classify(finalUrl, page, response);

            // If we only found 'global' (no specific types), it matches the "no results found" heuristic.
            // We wait for networkidle and try again to catch dynamic JSON-LD injection.
            // UPDATE: We now perform this wait more aggressively to ensure dynamic content (like accessibility widgets)
            // is fully loaded before running any plugins, not just for classification purposes.
            const waitTime = this.config.networkIdleTimeout ?? 5000;

            if (waitTime > 0) {
                try {
                    await page.waitForLoadState("networkidle", { timeout: waitTime });

                    finalUrl = page.url();
                    const retryResult = await this.classifier.classify(finalUrl, page, response);

                    // If we found more specific types or if the initial scan missed something dynamic
                    if (retryResult.types.length > matchedTypes.length || (matchedTypes.length === 1 && matchedTypes.includes("global"))) {
                        matchedTypes = retryResult.types;
                        classificationMeta = retryResult.meta;

                        logEvent({
                            event: "worker_log",
                            severity: "info",
                            message: `Refined classification after networkidle for ${finalUrl}: [${matchedTypes.join(", ")}]`,
                            workerId: this.workerId
                        });
                    }
                } catch {
                    // Ignore networkidle timeout, we proceed with whatever we have
                }
            }

            logEvent({
                event: "page_classified",
                severity: "info",
                message: `Classified ${finalUrl} (orig: ${job.url}) as: [${matchedTypes.join(", ")}]`,
                workerId: this.workerId,
                data: { url: job.url, finalUrl, types: matchedTypes, meta: classificationMeta }
            });

            // --- PLUGIN RESOLUTION STEP ---
            const pluginsToRun = this.resolvePluginsForTypes(matchedTypes);

            // --- SCENARIO EXECUTION ---
            try {
                const logs = await runScenario(finalUrl, page);
                for (const log of logs) {
                    logEvent({
                        event: "worker_log",
                        severity: "info",
                        message: `[Scenario] ${log}`,
                        workerId: this.workerId,
                    });
                }
            } catch (err: any) {
                logEvent({
                    event: "worker_log",
                    severity: "error",
                    message: `Scenario execution error: ${err.message}`,
                    workerId: this.workerId,
                });
            }

            const auditCtx: AuditContext = {
                run_id: job.run_id,
                url: finalUrl, // Pass final URL to plugins so they report correctly
                page,
                results: {},
                log: (msg) =>
                    logEvent({
                        event: "worker_log",
                        severity: "info",
                        message: msg,
                        workerId: this.workerId,
                    }),
                flags: { hasErrors: false },
            };

            // Expose cdpPort for lighthouse
            (auditCtx as any).cdpPort = this.cdpPort;

            // --- PLUGIN EXECUTION ---
            // Run plugins sequentially after discovery is safe
            await runPipeline(auditCtx, pluginsToRun, { timeoutMs: 60000 });

            // LOG: Debug log to inspect pipeline output
            const violationCount = auditCtx.results.a11y_violations?.length ?? 0;
            logEvent({
                event: "worker_log",
                severity: "info",
                message: `[DEBUG] Pipeline complete. Found violations: ${violationCount}`,
                workerId: this.workerId,
                data: {
                    violationIds: auditCtx.results.a11y_violations?.map((v: any) => v.id),
                    resultKeys: Object.keys(auditCtx.results)
                }
            });

            // Save results
            const normalizedOrig = normalizeUrl(job.url);
            const normalizedFinal = normalizeUrl(finalUrl);
            const isRedirect = normalizedOrig !== normalizedFinal;

            saveAuditResult(this.db, {
                run_id: job.run_id,
                url: job.url,
                results: {
                    ...auditCtx.results,
                    _page_types: matchedTypes,
                    _redirect_url: isRedirect ? finalUrl : undefined,
                    custom_data: {
                        ...auditCtx.results.custom_data,
                        ...classificationMeta
                    }
                },
            });

            updateJobStatus(this.db, job.id, "completed");
        } catch (error: any) {
            logEvent({
                event: "job_failed",
                severity: "error",
                message: `Worker ${this.workerId} failed audit job ${job.id}`,
                error: error instanceof Error ? error.message : String(error),
                workerId: this.workerId,
            });
            updateJobStatus(this.db, job.id, "failed");
        } finally {
            if (page) {
                await page.close().catch(() => { });
            }
        }
    }

    async stop(): Promise<void> {
        super.stop();
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.ctx = null;
        }
    }
}
