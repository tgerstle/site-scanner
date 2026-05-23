import { WorkerLoop } from "./worker-base.js";
import { setupFastContext, filterLinks, discoverLinks } from "./discovery.js";
import { logEvent } from "./logger.js";
import { claimNextJob, insertJob, updateJobStatus, getRunConfig } from "@scanner/db";
import type { Database } from "better-sqlite3";
import type { Browser, BrowserContext } from "playwright";
import type { ScannerConfig } from "@scanner/types";

export class DiscoveryWorker extends WorkerLoop {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private config: ScannerConfig;
    private db: Database;

    constructor(workerId: string, db: Database, config: ScannerConfig) {
        super("discovery", workerId);
        this.db = db;
        this.config = config;
    }

    async processJob(): Promise<void> {
        const job = claimNextJob(this.db, this.workerId, "discovery");
        if (!job) {
            // Nothing to do, just return and let the loop sleep
            return;
        }

        const runConfig = getRunConfig(this.db, job.run_id);
        const maxDepth = runConfig.targetDepth ?? runConfig.maxDepth ?? 3;
        const siteUrl = runConfig.siteUrl || new URL(job.url).origin;

        // Optimization: If we are at max depth, we don't need to discover new links.
        // We just need to pass this job to the audit worker.
        if (job.depth >= maxDepth) {
            updateJobStatus(this.db, job.id, "pending_audit");
            return;
        }

        if (!this.context) {
            const fastContext = await setupFastContext();
            this.browser = fastContext.browser;
            this.context = fastContext.context;
        }

        try {
            const links = await discoverLinks(job.url, this.context);

            const filtered = filterLinks(links, {
                baseUrl: siteUrl,
                includePaths: runConfig.includePaths || this.config.includePaths,
                excludePaths: runConfig.excludePaths || this.config.excludePaths,
            });

            const nextDepth = job.depth + 1;

            // We only insert if we haven't reached maxDepth
            if (nextDepth <= maxDepth) {
                // Run insertions in a transaction for speed
                const insertMany = this.db.transaction((urls: string[]) => {
                    for (const url of urls) {
                        insertJob(this.db, {
                            run_id: job.run_id,
                            url,
                            depth: nextDepth,
                        });
                    }
                });

                insertMany(filtered);
            }

            updateJobStatus(this.db, job.id, "pending_audit");
        } catch (error) {
            logEvent({
                event: "worker_warning",
                severity: "warn",
                plugin: "discovery",
                url: job.url,
                message: `[RESILIENCE] Worker ${this.workerId} caught discovery error for job ${job.id}. Proceeding to audit. Error: ${error instanceof Error ? error.message : String(error)}`,
                workerId: this.workerId,
            });
            // Even if discovery fails, try to audit the page
            updateJobStatus(this.db, job.id, "pending_audit");
        }
    }

    async stop(): Promise<void> {
        super.stop();
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.context = null;
        }
    }
}
