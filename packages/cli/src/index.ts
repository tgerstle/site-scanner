#!/usr/bin/env node
import { Command } from "commander";
import { ScannerConfig } from "@scanner/types";
import { logEvent, Orchestrator, analyzeRun, loadConfig, fetchSitemapUrls, normalizeUrl, setupFastContext, PageClassifier, flattenA11y, flattenPerformance, flattenSeo, generateGlobalRollup, generateCsvZipBuffer, generateXlsxBuffer } from "@scanner/core";
import { getDb, initializeSchema, createRun, insertJob, stopRun } from "@scanner/db";
import * as path from "node:path";
import * as fs from "node:fs";

const program = new Command();

program.name("awa").description("Adaptive Web Auditor CLI").version("1.0.0");

program
    .command("flush-logs")
    .description("Clear the scanner_run.log file")
    .action(() => {
        const logPath = path.resolve(process.cwd(), "scanner_run.log");
        if (fs.existsSync(logPath)) {
            fs.writeFileSync(logPath, "");
            console.log("Logs flushed successfully.");
        } else {
            console.log("No log file found.");
        }
        process.exit(0);
    });

program
    .command("start")
    .description("Start a new audit run")
    .option("-c, --config <path>", "Path to config file (e.g., awaconfig.json)")
    .option("-u, --url <url>", "Target URL to audit (overrides config)")
    .option("-l, --list <urls>", "Comma-separated list of URLs to audit (audit only, no crawl)")
    .option("-d, --depth <number>", "Maximum crawl depth") // Remove default "3" to allow logic below to handle it
    .option("-p, --plugins <plugins...>", "Plugins to run")
    .option("--network-timeout <ms>", "Wait time for network idle in ms (default: 5000)")
    .action(async (options) => { // Updated to async
        try {
            // Determine targets
            const directUrl = options.url ? options.url.trim() : null;
            const listUrls = options.list ? options.list.split(',').map((u: string) => u.trim()).filter(Boolean) : [];
            const targets = [directUrl, ...listUrls].filter(Boolean) as string[];

            if (targets.length === 0 && !options.config) {
                throw new Error("No URL or configuration provided. Use --url, --list, or --config.");
            }

            // Defaults: List = depth 0, else 3
            const defaultDepth = options.list ? 0 : 3;
            const depth = options.depth ? parseInt(options.depth, 10) : defaultDepth;

            const config = loadConfig(options.config, {
                siteUrl: targets[0], // Primary URL (important for sitemap base url)
                maxDepth: depth,
                plugins: options.plugins,
                networkIdleTimeout: options.networkTimeout ? parseInt(options.networkTimeout, 10) : undefined
            });

            logEvent({
                event: "run_started",
                severity: "info",
                message: `Starting audit for ${targets.length} target(s)`,
                config,
            });

            const dbPath = process.env.AWA_DB_PATH || path.resolve(process.cwd(), "data/awa.sqlite");
            const db = getDb(dbPath);
            initializeSchema(db);

            const runId = createRun(db, config);
            const discoveryMode = config.discovery?.mode || "crawl";

            // --- 1. Sitemap Ingestion ---
            if (discoveryMode === "sitemap" || discoveryMode === "hybrid") {
                const sitemapUrl = config.discovery?.sitemapUrl ||
                    (new URL("/sitemap.xml", config.siteUrl).toString());

                logEvent({ event: "sitemap_fetch", severity: "info", message: `Fetching sitemap: ${sitemapUrl}` });

                try {
                    const sitemapUrls = await fetchSitemapUrls(sitemapUrl);
                    logEvent({ event: "sitemap_processed", severity: "info", message: `Found ${sitemapUrls.length} pages in sitemap`, data: { count: sitemapUrls.length } });

                    if (sitemapUrls.length > 0) {
                        const insertTx = db.transaction((urls: string[]) => {
                            for (const url of urls) {
                                // Sitemap URLs are treated as "leaf" nodes (max depth) unless explicitly crawled
                                // To avoid deep crawling from every sitemap entry.
                                // But if 'sitemap' only, we just want to audit them.
                                insertJob(db, { run_id: runId, url, depth: config.maxDepth, priority: 50 });
                            }
                        });
                        insertTx(sitemapUrls);
                    }
                } catch (e: any) {
                    logEvent({ event: "sitemap_error", severity: "error", message: `Failed to process sitemap: ${e.message}` });
                    // If sitemap fails in sitemap-only mode, we probably should abort or warn?
                    // Proceeding might be okay if 'hybrid', but bad if 'sitemap'.
                }
            }

            // --- 2. Crawl Seeds ---
            if (discoveryMode === "crawl" || discoveryMode === "hybrid") {
                // Insert explicit targets as seeds (depth 0)
                // This triggers the Discovery Worker to crawl them
                for (const url of targets) {
                    insertJob(db, { run_id: runId, url, depth: 0, priority: 100 });
                }
            } else if (discoveryMode === "sitemap" && targets.length > 0) {
                // Even in sitemap mode, explicit targets should probably be audited?
                // Let's treat them as manual overrides
                for (const url of targets) {
                    insertJob(db, { run_id: runId, url, depth: config.maxDepth, priority: 100 });
                }
            }

            // Output JSON for programmatic usage
            console.log(JSON.stringify({ runId, status: "started", count: targets.length }));

            const orchestrator = new Orchestrator(db);
            orchestrator.startZombieDetection();

            // Consolidated Worker Mode:
            // We launch multiple "audit" workers that handle both discovery and auditing.
            // This replaces the separate Discovery/Audit phases.
            const auditWorker1 = orchestrator.spawnWorker("audit", `${runId}_aud_1`);
            const auditWorker2 = orchestrator.spawnWorker("audit", `${runId}_aud_2`);

            // Poll for completion
            const checkInterval = setInterval(() => {
                // Include 'processing' in the check
                const pending = (db.prepare("SELECT COUNT(*) as count FROM queue WHERE run_id = ? AND status IN ('pending', 'processing', 'processing_discovery', 'pending_audit', 'processing_audit')").get(runId) as any).count;

                if (pending === 0) {
                    clearInterval(checkInterval);
                    const failedCount = (db.prepare("SELECT COUNT(*) as count FROM queue WHERE run_id = ? AND status = 'failed'").get(runId) as any).count;
                    const totalCount = (db.prepare("SELECT COUNT(*) as count FROM queue WHERE run_id = ?").get(runId) as any).count;

                    // If everything failed, mark run as failed
                    const finalStatus = (failedCount > 0 && failedCount === totalCount) ? 'failed' : 'completed';

                    // Run post-scan analysis (duplicates, aggregation) before marking completion
                    try {
                        analyzeRun(db, runId);
                    } catch (e: any) {
                        console.error("Post-scan analysis failed:", e);
                    }

                    db.prepare("UPDATE runs SET status = ?, completed_at = ? WHERE id = ?").run(finalStatus, new Date().toISOString(), runId);

                    logEvent({
                        event: "run_completed",
                        severity: "info",
                        message: `Run ${runId} finished with status: ${finalStatus}`,
                        runId
                    });

                    orchestrator.stopZombieDetection();
                    orchestrator.killAll();
                    db.close();
                    process.exit(0);
                }
            }, 5000); // Check every 5 seconds

            process.on("SIGINT", () => {
                logEvent({
                    event: "run_interrupted",
                    severity: "warn",
                    message: "Stopping run via SIGINT...",
                });
                orchestrator.stopZombieDetection();
                orchestrator.killAll();
                stopRun(db, runId);
                db.close();
                process.exit(0);
            });

            process.on("SIGTERM", () => {
                logEvent({
                    event: "run_terminated",
                    severity: "warn",
                    message: "Stopping run via SIGTERM...",
                });
                orchestrator.stopZombieDetection();
                orchestrator.killAll();
                stopRun(db, runId); // Helper updates status to 'stopped'
                db.close();
                process.exit(0);
            });
        } catch (e: any) {
            logEvent({
                event: "cli_error",
                severity: "error",
                message: e.message || "Invalid configuration",
                error: e,
            });
            process.exit(1);
        }
    });

program
    .command("resume")
    .description("Resume an interrupted run")
    .requiredOption("--run-id <id>", "The ID of the run to resume")
    .action((options) => {
        try {
            const dbPath = process.env.AWA_DB_PATH || path.resolve(process.cwd(), "data/awa.sqlite");
            if (!fs.existsSync(dbPath)) throw new Error("No database found.");
            const db = getDb(dbPath);

            const run = db.prepare("SELECT * FROM runs WHERE id = ?").get(options.runId);
            if (!run) throw new Error(`Run ID ${options.runId} not found.`);

            logEvent({
                event: "run_resumed",
                severity: "info",
                message: `Resuming audit run ${options.runId}`,
                runId: options.runId,
            });

            const orchestrator = new Orchestrator(db);
            orchestrator.startZombieDetection();

            const discoveryWorker = orchestrator.spawnWorker("discovery", `${options.runId}_disc_res`);
            const auditWorker = orchestrator.spawnWorker("audit", `${options.runId}_aud_res`);

            process.on("SIGINT", () => {
                logEvent({
                    event: "run_interrupted",
                    severity: "warn",
                    message: "Stopping orchestrator...",
                });
                orchestrator.stopZombieDetection();
                discoveryWorker.kill();
                auditWorker.kill();
                db.close();
                process.exit(0);
            });
        } catch (e: any) {
            logEvent({
                event: "cli_error",
                severity: "error",
                message: e.message || "Failed to resume run",
            });
            process.exit(1);
        }
    });

program
    .command("status")
    .description("View the progress of an ongoing run")
    .requiredOption("--run-id <id>", "The ID of the run to check")
    .action((options) => {
        try {
            const dbPath = process.env.AWA_DB_PATH || path.resolve(process.cwd(), "data/awa.sqlite");
            if (!fs.existsSync(dbPath)) throw new Error("No database found.");
            const db = getDb(dbPath);

            const query = "SELECT COUNT(*) as count FROM queue WHERE run_id = ? AND status = ?";
            const pending = (db.prepare(query).get(options.runId, "pending") as any).count;
            const processing = (db.prepare(query).get(options.runId, "processing") as any).count;
            const completed = (db.prepare(query).get(options.runId, "completed") as any).count;
            const failed = (db.prepare(query).get(options.runId, "failed") as any).count;

            const metrics = { pending, processing, completed, failed };
            logEvent({
                event: "run_status",
                severity: "info",
                message: `Status for run ${options.runId}`,
                runId: options.runId,
                metrics,
            });

            process.stdout.write(JSON.stringify(metrics, null, 2) + "\n");
            db.close();
        } catch (e: any) {
            logEvent({
                event: "cli_error",
                severity: "error",
                message: e.message || "Failed to check status",
            });
            process.exit(1);
        }
    });

program
    .command("stop")
    .description("Stop all active audit runs or a specific one")
    .option("--run-id <id>", "Stop a specific run ID")
    .option("--all", "Stop all running audits")
    .action(async (options) => {
        try {
            const dbPath = process.env.AWA_DB_PATH || path.resolve(process.cwd(), "data/awa.sqlite");
            if (!fs.existsSync(dbPath)) {
                console.log("No database found.");
                return;
            }
            const db = getDb(dbPath);
            // Ensure schema is up to date (migrations)
            initializeSchema(db);

            let runs: any[] = [];

            if (options.runId) {
                runs = db.prepare("SELECT * FROM runs WHERE id = ? AND status = 'running'").all(options.runId) as any[];
            } else if (options.all) {
                runs = db.prepare("SELECT * FROM runs WHERE status = 'running'").all() as any[];
            } else {
                console.error("Please specify --run-id <id> or --all");
                process.exit(1);
            }

            if (runs.length === 0) {
                console.log("No active runs found.");
                return;
            }

            console.log(`Found ${runs.length} active run(s). Stopping...`);

            for (const run of runs) {
                if (run.pid) {
                    try {
                        // Check if process exists first
                        process.kill(run.pid, 0);
                        process.kill(run.pid, "SIGINT");
                        console.log(`Sending SIGINT to process ${run.pid} (Run ${run.id})`);

                        // Wait for process to exit (up to 2 seconds)
                        let tries = 0;
                        while (tries < 20) {
                            try {
                                process.kill(run.pid, 0); // Check if still running
                                await new Promise(resolve => setTimeout(resolve, 100));
                                tries++;
                            } catch (e) {
                                break; // Process exited
                            }
                        }
                    } catch (e: any) {
                        if (e.code === 'ESRCH') {
                            console.log(`Process ${run.pid} (Run ${run.id}) not found.`);
                        } else {
                            console.error(`Error killing process ${run.pid}: ${e.message}`);
                        }
                    }
                }
                db.prepare("UPDATE runs SET status = 'stopped' WHERE id = ?").run(run.id);
                // Also update any pending queue items to 'stopped' so they don't count as pending
                db.prepare("UPDATE queue SET status = 'stopped' WHERE run_id = ? AND status NOT IN ('completed', 'failed')").run(run.id);
            }
            db.close();
        } catch (e: any) {
            console.error("Error stopping runs:", e.message);
            process.exit(1);
        }
    });

program
    .command("reset")
    .description("Reset the database (wipe all data)")
    .option("-f, --force", "Force reset without confirmation")
    .action(async (options) => {
        if (!options.force) {
            console.warn("This will delete all audit data. Use --force to confirm.");
            process.exit(1);
        }
        try {
            const dbPath = process.env.AWA_DB_PATH || path.resolve(process.cwd(), "data/awa.sqlite");
            if (!fs.existsSync(dbPath)) {
                console.log("No database found.");
                return;
            }

            console.log("Resetting database...");
            const db = getDb(dbPath);

            // Delete all tables
            const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];
            db.exec("PRAGMA foreign_keys = OFF");
            for (const { name } of tables) {
                db.prepare(`DROP TABLE IF EXISTS ${name}`).run();
            }
            db.exec("PRAGMA foreign_keys = ON");

            // Re-initialize schema
            initializeSchema(db);
            console.log("Database reset complete.");
            db.close();
        } catch (e: any) {
            console.error("Error resetting database:", e.message);
            process.exit(1);
        }
    });

program
    .command("export")
    .description("Export audit results to XLSX or CSV (ZIP)")
    .requiredOption("--run-id <id>", "The Run ID to export")
    .option("--format <format>", "Export format: xlsx or csv", "xlsx")
    .option("--output <file>", "Output file path")
    .action(async (options) => {
        try {
            const dbPath = process.env.AWA_DB_PATH || path.resolve(process.cwd(), "data/awa.sqlite");
            if (!fs.existsSync(dbPath)) {
                console.error("No database found.");
                process.exit(1);
            }
            const db = getDb(dbPath);

            const run = db.prepare("SELECT * FROM runs WHERE id = ?").get(options.runId) as any;
            if (!run) {
                console.error(`Run ID ${options.runId} not found.`);
                process.exit(1);
            }

            console.log(`Generating export datasets for run ${options.runId}...`);

            const a11yData = flattenA11y(db, options.runId);
            const performanceData = flattenPerformance(db, options.runId);
            const seoData = flattenSeo(db, options.runId);
            const globalRollup = generateGlobalRollup(a11yData, performanceData, seoData);

            const datasets = {
                global: globalRollup,
                a11y: a11yData,
                performance: performanceData,
                seo: seoData
            };

            let buffer: Buffer | undefined;
            const formatStr = options.format.toLowerCase();
            let defaultFileName = "";
            let generatedContent = "";

            if (formatStr === 'csv') {
                console.log('Generating CSV Zip buffer...');
                buffer = await generateCsvZipBuffer(datasets);
                defaultFileName = `scanner-export-${options.runId}.zip`;
            } else if (formatStr === 'json') {
                // legacy json fallback
                generatedContent = JSON.stringify(datasets, null, 2);
                defaultFileName = `scanner-export-${options.runId}.json`;
            } else {
                console.log('Generating XLSX buffer...');
                buffer = await generateXlsxBuffer(datasets);
                defaultFileName = `scanner-export-${options.runId}.xlsx`;
            }

            const outputFile = options.output || defaultFileName;

            if (formatStr === 'json') {
                if (options.output) fs.writeFileSync(outputFile, generatedContent);
                else console.log(generatedContent);
            } else if (buffer) {
                fs.writeFileSync(outputFile, buffer);
                console.log(`Exported run ${options.runId} successfully to ${outputFile}`);
            }

            db.close();
        } catch (e: any) {
            console.error("Error exporting run:", e.message);
            process.exit(1);
        }
    });

program
    .command("classify")
    .description("Test page classification for a given URL")
    .requiredOption("-u, --url <url>", "URL to classify")
    .option("-c, --config <path>", "Path to config file")
    .action(async (options) => {
        try {
            const config = loadConfig(options.config, { siteUrl: options.url });
            const classifier = new PageClassifier(config);

            console.log(`Classifying ${options.url}...`);
            const { browser, context } = await setupFastContext();

            try {
                const page = await context.newPage();
                // Use networkidle to ensure JSON-LD and other dynamic content is loaded
                const response = await page.goto(options.url, { waitUntil: "networkidle", timeout: 60000 });

                const finalUrl = page.url();
                if (finalUrl !== options.url) {
                    // console.log(`Redirected to: ${finalUrl}`); // Quiet for JSON output
                }

                const result = await classifier.classify(finalUrl, page, response);
                console.log(JSON.stringify(result.types, null, 2));

            } finally {
                // Ensure browser is closed even if classify throws or network idle times out
                if (browser) await browser.close();
            }
        } catch (error: any) {
            console.error("Classification failed:", error.message);
            // Explicitly exit process
            process.exit(1);
        }
        // Success exit
        process.exit(0);
    });

program.parse(process.argv);
