#!/usr/bin/env node

/**
 * Phase 5: Backfill script for non-HTML metadata
 *
 * Classifies existing queue rows that lack resource_type/audit_disposition
 * by inferring type from extension and assigning disposition.
 *
 * Usage:
 *   npx ts-node scripts/backfill-non-html-metadata.ts [--db-path <path>] [--dry-run]
 *
 * Example:
 *   npx ts-node scripts/backfill-non-html-metadata.ts --db-path data/awa.sqlite
 */

import Database from "better-sqlite3";
import * as path from "node:path";
import * as process from "node:process";
import { getDb } from "../packages/db/src/connection.js";
import { triageResource } from "../packages/core/src/resource-triage.js";

interface BackfillOptions {
    dbPath: string;
    dryRun: boolean;
    verbose: boolean;
}

function parseArgs(): BackfillOptions {
    const args = process.argv.slice(2);
    const options: BackfillOptions = {
        dbPath: path.resolve(process.cwd(), "data/awa.sqlite"),
        dryRun: false,
        verbose: false,
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--db-path" && args[i + 1]) {
            options.dbPath = path.resolve(args[++i]);
        } else if (arg === "--dry-run") {
            options.dryRun = true;
        } else if (arg === "--verbose" || arg === "-v") {
            options.verbose = true;
        }
    }

    return options;
}

async function backfill(options: BackfillOptions): Promise<void> {
    console.log(`📦 Phase 5 Backfill: Non-HTML Metadata Classification`);
    console.log(
        `📄 Database: ${options.dbPath} (${options.dryRun ? "DRY-RUN" : "WRITE"})`
    );
    console.log("");

    const db = getDb(options.dbPath);

    try {
        // Find rows that need backfilling (missing metadata)
        const rowsNeedingBackfill = db
            .prepare(
                `
        SELECT id, url, run_id, depth, status
        FROM queue
        WHERE resource_type IS NULL OR audit_disposition IS NULL
        ORDER BY id ASC
      `
            )
            .all() as Array<{
                id: number;
                url: string;
                run_id: string;
                depth: number;
                status: string;
            }>;

        console.log(
            `📊 Found ${rowsNeedingBackfill.length} row(s) needing backfill\n`
        );

        if (rowsNeedingBackfill.length === 0) {
            console.log("✅ All rows already have metadata. Nothing to do.");
            return;
        }

        let processedCount = 0;
        let htmlCount = 0;
        let documentCount = 0;
        let mediaCount = 0;
        let binaryCount = 0;
        let unknownCount = 0;

        const updateStmt = db.prepare(`
      UPDATE queue
      SET resource_type = ?, audit_disposition = ?, skip_reason = ?
      WHERE id = ?
    `);

        const transaction = db.transaction(
            (
                rows: Array<{
                    id: number;
                    url: string;
                    run_id: string;
                    depth: number;
                    status: string;
                }>
            ) => {
                for (const row of rows) {
                    const triage = triageResource(row.url);

                    if (options.verbose) {
                        console.log(
                            `  [${row.id}] ${row.url} → ${triage.resourceType}:${triage.auditDisposition}`
                        );
                    }

                    if (!options.dryRun) {
                        updateStmt.run(
                            triage.resourceType,
                            triage.auditDisposition,
                            triage.skipReason ?? null,
                            row.id
                        );
                    }

                    processedCount++;
                    switch (triage.resourceType) {
                        case "html":
                            htmlCount++;
                            break;
                        case "document":
                            documentCount++;
                            break;
                        case "media":
                            mediaCount++;
                            break;
                        case "binary":
                            binaryCount++;
                            break;
                        default:
                            unknownCount++;
                    }
                }
            }
        );

        // Execute transaction
        transaction(rowsNeedingBackfill);

        console.log("\n📈 Backfill Results:");
        console.log(`  Total processed: ${processedCount}`);
        console.log(`  • HTML pages: ${htmlCount}`);
        console.log(`  • Documents: ${documentCount}`);
        console.log(`  • Media: ${mediaCount}`);
        console.log(`  • Binary: ${binaryCount}`);
        console.log(`  • Unknown: ${unknownCount}`);

        if (options.dryRun) {
            console.log("\n⚠️  DRY-RUN mode: No changes written to database.");
        } else {
            console.log("\n✅ Backfill complete. Metadata updated.");
        }
    } finally {
        db.close();
    }
}

// Main
const options = parseArgs();
backfill(options).catch((err) => {
    console.error("❌ Backfill error:", err.message);
    process.exit(1);
});
