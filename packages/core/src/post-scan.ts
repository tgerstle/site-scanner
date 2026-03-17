import type { Database } from "better-sqlite3";
import { logEvent } from "./logger.js";

export function analyzeRun(db: Database, runId: string) {
    logEvent({
        event: "post_scan_analysis",
        severity: "info",
        message: `Analyzing run ${runId} for issues...`,
        runId
    });

    try {
        identifyDuplicates(db, runId);
    } catch (e: any) {
        logEvent({
            event: "post_scan_error",
            severity: "error",
            message: `Post-scan analysis failed for run ${runId}`,
            error: e.message || String(e),
            runId
        });
    }
}

function identifyDuplicates(db: Database, runId: string) {
    // Fetch all completed pages with their custom data and other relevant scores
    const pages = db.prepare(`
        SELECT q.id, q.url, q.status, r.custom_data, r.seo_score, r.a11y_violations, r.redirect_url
        FROM queue q 
        LEFT JOIN results r ON q.run_id = r.run_id AND q.url = r.url
        WHERE q.run_id = ? AND q.status = 'completed'
    `).all(runId) as any[];

    if (pages.length < 2) return;

    // Normalization map: strippedUrl -> Array of items
    const groups = new Map<string, any[]>();

    for (const page of pages) {
        // Strip trailing slash and query params for comparison (aggressive normalization)
        // actually for now just trailing slash to be safe and match user request
        const norm = page.url.replace(/\/$/, "");
        if (!groups.has(norm)) {
            groups.set(norm, []);
        }
        groups.get(norm)!.push(page);
    }


    let duplicateCount = 0;
    const alertDetails: any[] = [];

    db.transaction(() => {
        for (const [normUrl, items] of groups) {
            if (items.length > 1) {
                // Determine scores. Use performance_score if available, else 1
                items.forEach((item) => {
                    item.score = 0;
                    if (item.custom_data) {
                        try {
                            const data = JSON.parse(item.custom_data);
                            if (typeof data.performance_score === 'number') {
                                item.score = data.performance_score;
                            }
                        } catch (e) { }
                    }

                    // Parse a11y count
                    item.a11y_count = 0;
                    if (item.a11y_violations) {
                        try {
                            const v = JSON.parse(item.a11y_violations);
                            if (Array.isArray(v)) {
                                item.a11y_count = v.reduce((sum: number, issue: any) => sum + (issue.nodes?.length || 0), 0);
                            }
                        } catch (e) { }
                    }
                });

                // Heuristic: Identify the duplicates but DO NOT MERGE (do not update database 'duplicate_of' column).
                // Just collect them for the alert.

                // Still sort by score just so we can show worst first in report if needed, 
                // but effectively we are reporting all variants.
                items.sort((a, b) => b.score - a.score); // Sort best score first

                duplicateCount++; // Count groups found, or total extra items? Let's count total redundant URLs.
                // If 3 items in group, that is 2 redundant. (items.length - 1)

                // For reporting, let's list them all
                alertDetails.push({
                    normalizedUrl: normUrl,
                    variants: items.map(i => ({
                        url: i.url,
                        score: i.score, // Perf
                        seo: i.seo_score,
                        a11y: i.a11y_count,
                        redirect: i.redirect_url
                    }))
                });
            }
        }

        if (alertDetails.length > 0) {
            const totalDuplicates = alertDetails.reduce((sum, group) => sum + (group.variants.length - 1), 0);

            db.prepare(`
                INSERT INTO scan_alerts (run_id, type, message, details_json) 
                VALUES (?, ?, ?, ?)
            `).run(
                runId,
                'duplicate_content',
                `Found ${totalDuplicates} potential duplicate URLs (e.g. trailing slashes). This often indicates split link equity or configuration issues.`,
                JSON.stringify(alertDetails)
            );

            logEvent({
                event: "duplicates_found",
                severity: "warn",
                message: `Found ${totalDuplicates} duplicate URLs in run ${runId}`,
                runId
            });
        }
    })();
}
