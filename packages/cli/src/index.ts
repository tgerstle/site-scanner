#!/usr/bin/env node
import { Command } from "commander";
import { loadConfig } from "types";
import { logEvent, Orchestrator, analyzeRun } from "core";
import { getDb, initializeSchema, createRun, insertJob } from "db";
import * as path from "node:path";
import * as fs from "node:fs";

const program = new Command();

program.name("awa").description("Adaptive Web Auditor CLI").version("1.0.0");

program
    .command("start")
    .description("Start a new audit run")
    .option("-c, --config <path>", "Path to config file (e.g., awaconfig.json)")
    .option("-u, --url <url>", "Target URL to audit (overrides config)")
    .option("-l, --list <urls>", "Comma-separated list of URLs to audit (audit only, no crawl)")
    .option("-d, --depth <number>", "Maximum crawl depth") // Remove default "3" to allow logic below to handle it
    .option("-p, --plugins <plugins...>", "Plugins to run")
    .action((options) => {
        try {
            // Determine targets
            const directUrl = options.url ? options.url.trim() : null;
            const listUrls = options.list ? options.list.split(',').map((u: string) => u.trim()).filter(Boolean) : [];
            const targets = [directUrl, ...listUrls].filter(Boolean) as string[];

            if (targets.length === 0 && !options.config) {
                throw new Error("No URL or configuration provided. Use --url, --list, or --config.");
            }

            // If using a list or explicit URLs without config file, default depth to 0 (audit only) unless specified
            // If just -u is provided, we usually crawl, but if -l is provided, we usually just want those pages.
            // Let's say: if list is present, default depth is 0. If only -u, default is 3.
            const defaultDepth = options.list ? 0 : 3;
            const depth = options.depth ? parseInt(options.depth, 10) : defaultDepth;

            const config = loadConfig(options.config, {
                siteUrl: targets[0], // Primary URL for run ID/logging
                maxDepth: depth,
                plugins: options.plugins,
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

            // Insert all targets
            for (const url of targets) {
                insertJob(db, { run_id: runId, url, depth: 0, priority: 100 });
            }

            // Output JSON for programmatic usage
            console.log(JSON.stringify({ runId, status: "started", count: targets.length }));

            const orchestrator = new Orchestrator(db);
            orchestrator.startZombieDetection();

            const discoveryWorker = orchestrator.spawnWorker("discovery", `${runId}_disc_1`);
            const auditWorker = orchestrator.spawnWorker("audit", `${runId}_aud_1`);

            // Poll for completion
            const checkInterval = setInterval(() => {
                const pending = (db.prepare("SELECT COUNT(*) as count FROM queue WHERE run_id = ? AND status IN ('pending', 'processing_discovery', 'pending_audit', 'processing_audit')").get(runId) as any).count;

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
                    discoveryWorker.kill();
                    auditWorker.kill();
                    db.close();
                    process.exit(0);
                }
            }, 5000); // Check every 5 seconds

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
    .description("Export audit results to JSON or CSV")
    .requiredOption("--run-id <id>", "The Run ID to export")
    .option("--format <format>", "Export format (json or csv)", "json")
    .option("--output <file>", "Output file path (defaults to stdout if not specified)")
    .action((options) => {
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

            // Replicate query logic from web app
            const pages = db.prepare(`
                SELECT 
                    q.url, 
                    q.status, 
                    q.depth,
                    COALESCE(SUM(a.count), 0) as violation_count
                FROM queue q
                LEFT JOIN a11y_findings a ON q.url = a.url AND q.run_id = a.run_id
                WHERE q.run_id = ?
                GROUP BY q.id
                ORDER BY violation_count DESC
            `).all(options.runId);

            // Map statuses if stopped
            const effectivePages = pages.map((p: any) => {
                if (run.status === 'stopped' && ['pending', 'processing', 'pending_audit'].includes(p.status)) {
                    return { ...p, status: 'stopped' };
                }
                return p;
            });

            const totalViolations = effectivePages.reduce((acc: number, p: any) => acc + p.violation_count, 0);

            const runDetail = {
                id: run.id,
                started_at: run.started_at,
                status: run.status,
                config: run.config_json ? JSON.parse(run.config_json) : {},
                url_count: effectivePages.length,
                violation_count: totalViolations,
                pages: effectivePages
            };

            let outputContent = "";

            if (options.format.toLowerCase() === 'csv') {
                const headers = ['URL', 'Status', 'Depth', 'Violations'];
                const rows = runDetail.pages.map((page: any) => [
                    `"${page.url}"`,
                    page.status,
                    page.depth,
                    page.violation_count
                ]);
                outputContent = [headers.join(','), ...rows.map((row: any[]) => row.join(','))].join('\n');
            } else {
                outputContent = JSON.stringify(runDetail, null, 2);
            }

            if (options.output) {
                fs.writeFileSync(options.output, outputContent);
                console.log(`Exported run ${options.runId} to ${options.output}`);
            } else {
                console.log(outputContent);
            }

            db.close();
        } catch (e: any) {
            console.error("Error exporting run:", e.message);
            process.exit(1);
        }
    });

program.parse(process.argv);
