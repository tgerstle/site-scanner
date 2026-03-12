import { WorkerLoop } from "./worker-base.js";
import { runPipeline } from "./pipeline.js";
import { logEvent } from "./logger.js";
import { claimNextJob, updateJobStatus, saveAuditResult } from "db";
import type { Database } from "better-sqlite3";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type { ScannerConfig, AuditContext, AuditPlugin } from "types";

// This will be dynamically loaded based on config, but for now we'll accept them in the constructor
export class AuditWorker extends WorkerLoop {
    private browser: Browser | null = null;
    private ctx: BrowserContext | null = null;
    private config: ScannerConfig;
    private db: Database;
    private plugins: AuditPlugin[];
    private cdpPort: number;

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
        this.plugins = plugins;

        // Assign a random port if default is used to avoid collisions
        this.cdpPort = cdpPort === 9222 ? 9222 + Math.floor(Math.random() * 500) : cdpPort;
        logEvent({
            event: "worker_init",
            severity: "info",
            message: `Worker ${workerId} initialized with CDP port ${this.cdpPort}`,
            workerId: this.workerId
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
            await page.goto(job.url, { waitUntil: "domcontentloaded", timeout: 60000 });

            // Optional: wait for a short bit to let things settle, but don't fail if network is busy
            try {
                await page.waitForLoadState("networkidle", { timeout: 5000 });
            } catch (e) {
                // Ignore networkidle timeout, we proceed with audit
            }

            const auditCtx: AuditContext = {
                run_id: job.run_id,
                url: job.url,
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

            await runPipeline(auditCtx, this.plugins);

            // Save results
            saveAuditResult(this.db, {
                run_id: job.run_id,
                url: job.url,
                results: auditCtx.results,
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
