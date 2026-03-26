// Ensure this matches your existing types or imports them
import type {
    DashboardStats,
    QueueItem,
    RecentItem,
    RunSummary,
    RunDetail,
    PageSummary,
    CommonA11yIssue
} from "../types";
import { getDb, initializeSchema } from 'db';
import path from 'node:path';
import fs from 'node:fs';

let _db: ReturnType<typeof getDb> | null = null;

export function getDatabase() {
    // In dev mode, or always for now to debug, let's create a fresh connection each request.
    // This avoids stale WAL reader issues if the DB is wiped externaly.
    if (_db) {
        try {
            // Check if connection is alive (dummy query)
            _db.prepare('SELECT 1').get();
        } catch (e) {
            _db = null; // Reconnect
        }
    }

    if (!_db) {
        // Resolve to workspace root, fallback logic for dev vs prod running dirs could be mapped via env
        const dbPath = process.env.AWA_DB_PATH || path.resolve(process.cwd(), '../../data/awa.sqlite');

        console.log(`[Queries] Connecting to DB at: ${dbPath}`);

        // Ensure the directory exists if it doesn't
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const db = getDb(dbPath);
        // Ensure WAL mode is active
        db.pragma('journal_mode = WAL');
        initializeSchema(db);
        _db = db;
    }
    return _db;
}

export function getStats(): DashboardStats {
    const db = getDatabase();

    // Get active runs or most recent run
    const activeRuns = db.prepare(`
        SELECT id, status, started_at, completed_at, config_json 
        FROM runs 
        WHERE status IN ('running', 'pending')
        ORDER BY started_at DESC
    `).all() as { id: string, status: string, started_at: string, completed_at: string, config_json: string }[];

    let targetRuns = activeRuns;
    if (targetRuns.length === 0) {
        // Fallback to most recent run if no active runs
        const lastRun = db.prepare(`
            SELECT id, status, started_at, completed_at, config_json 
            FROM runs 
            ORDER BY started_at DESC 
            LIMIT 1
        `).get() as { id: string, status: string, started_at: string, completed_at: string, config_json: string } | undefined;

        if (lastRun) targetRuns.push(lastRun);
    }

    return targetRuns.map(run => {
        const runId = run.id;

        // Count queue items by status
        const counts = db.prepare(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                SUM(CASE WHEN status = 'stopped' THEN 1 ELSE 0 END) as stopped,
                SUM(CASE WHEN status NOT IN ('completed', 'failed', 'stopped') THEN 1 ELSE 0 END) as pending
            FROM queue
            WHERE run_id = ?
        `).get(runId) as any;

        // Count violations
        const violations = (db.prepare(`
            SELECT SUM(count) as count 
            FROM a11y_findings 
            WHERE run_id = ?
        `).get(runId) as any).count || 0;

        let urlLabel = 'Unknown Scan';
        try {
            if (run.config_json) {
                const config = JSON.parse(run.config_json);
                if (config.url || config.siteUrl) { // Check siteUrl which is used by CLI
                    urlLabel = config.url || config.siteUrl;
                } else if (Array.isArray(config.urls) && config.urls.length > 0) {
                    urlLabel = `${config.urls[0]} (+${config.urls.length - 1} more)`;
                } else if (config.sitemap) {
                    urlLabel = `Sitemap: ${config.sitemap}`;
                }
            }
        } catch (e) {
            console.error('Failed to parse config for run', run.id, e);
        }

        return {
            runId,
            status: run.status,
            created_at: run.started_at,
            completed_at: run.completed_at,
            url: urlLabel,
            totalUrls: counts.total || 0,
            pendingUrls: counts.pending || 0,
            completedUrls: counts.completed || 0,
            failedUrls: counts.failed || 0,
            stoppedUrls: counts.stopped || 0,
            totalViolations: violations
        };
    });
}

export function getRecentUrls(): RecentItem[] {
    const db = getDatabase();
    return db.prepare(`
    SELECT 
      q.id, 
      q.url, 
      q.status, 
      q.depth, 
      COALESCE(res.timestamp, r.started_at) as timestamp,
      COALESCE(SUM(a.count), 0) AS violationCount
    FROM queue q
    JOIN runs r ON q.run_id = r.id
    LEFT JOIN results res ON q.url = res.url AND q.run_id = res.run_id
    LEFT JOIN a11y_findings a ON q.url = a.url AND q.run_id = a.run_id
    GROUP BY q.id
    ORDER BY violationCount DESC
    LIMIT 10
  `).all() as RecentItem[];
}

export function getQueue(): QueueItem[] {
    const db = getDatabase();
    return db.prepare(`
    SELECT 
      q.id, 
      q.url, 
      q.status, 
      q.depth,
      r.started_at as timestamp
    FROM queue q
    JOIN runs r ON q.run_id = r.id
    WHERE q.status != 'completed'
    ORDER BY q.id ASC
    LIMIT 10
  `).all() as QueueItem[];
}

export function getRuns(): RunSummary[] {
    const db = getDatabase();

    const sql = `
    SELECT 
      r.id, 
      r.started_at, 
      r.completed_at,
      r.status, 
      r.config_json,
      (SELECT COUNT(*) FROM queue q WHERE q.run_id = r.id) as url_count,
      (SELECT COALESCE(SUM(a.count), 0) FROM a11y_findings a WHERE a.run_id = r.id) as violation_count
    FROM runs r
    ORDER BY r.started_at DESC
  `;

    return db.prepare(sql).all().map((row: any) => ({
        ...row,
        config: row.config_json ? JSON.parse(row.config_json) : {}
    }));
}

export function getRunDetails(runId: string): RunDetail | null {
    const db = getDatabase();

    // Get Run Info
    const run = db.prepare(`SELECT * FROM runs WHERE id = ?`).get(runId) as any;
    if (!run) return null;

    // Get Page List with Violation Counts
    // Optimized to avoid N+1 queries by joining findings
    const pages = db.prepare(`
    SELECT 
      q.url, 
      q.status, 
      q.depth,
      COALESCE(SUM(a.count), 0) as violation_count,
      r.seo_score,
      r.seo_result,
      r.custom_data,
      r.page_types,
      r.redirect_url
    FROM queue q
    LEFT JOIN a11y_findings a ON q.url = a.url AND q.run_id = a.run_id
    LEFT JOIN results r ON q.url = r.url AND q.run_id = r.run_id
    WHERE q.run_id = ?
    GROUP BY q.id
    ORDER BY violation_count DESC
  `).all(runId);

    // Get Aggregate Stats
    const totalViolations = pages.reduce((acc: number, p: any) => acc + p.violation_count, 0);

    // If the run is stopped, map any 'pending' or 'processing' statuses to 'stopped'
    // This handles race conditions where rows were added/updated as the run was stopping.
    const effectivePages = pages.map((p: any) => {
        let page = { ...p };
        if (run.status === 'stopped' && ['pending', 'processing', 'pending_audit'].includes(p.status)) {
            page.status = 'stopped';
        }

        // Parse page_types if present
        if (p.page_types) {
            try {
                page.pageTypes = JSON.parse(p.page_types);
            } catch (e) {
                // ignore
            }
        }

        // Map redirect_url
        if (p.redirect_url) {
            page.redirectUrl = p.redirect_url;
        }

        // Parse custom_data for lighthouse scores
        try {
            if (p.custom_data) {
                const custom = JSON.parse(p.custom_data);
                if (typeof custom === "object" && custom !== null) {
                    page.performance_score = custom.performance_score;
                    page.accessibility_score = custom.accessibility_score;
                    page.best_practices_score = custom.best_practices_score;
                }
            }
        } catch (e) {
            // ignore JSON parse error
        }

        // Parse seo_result
        try {
            if (p.seo_result) {
                page.seo_result = JSON.parse(p.seo_result);
            }
        } catch (e) {
            // ignore
        }

        return page;
    });

    const completedPagesWithScores = effectivePages.filter((p: any) => p.status === 'completed' && (p.performance_score !== undefined || p.seo_score !== undefined));

    const avg = (key: string) => {
        // Ensure values are numbers
        const valid = effectivePages.filter((p: any) => typeof p[key] === 'number');
        if (valid.length === 0) return undefined;
        const sum = valid.reduce((acc: number, p: any) => acc + p[key], 0);
        return sum / valid.length;
    };

    return {
        id: run.id,
        started_at: run.started_at,
        status: run.status,
        config: run.config_json ? JSON.parse(run.config_json) : {},
        url_count: effectivePages.length,
        violation_count: totalViolations,
        avg_performance_score: avg('performance_score'),
        avg_accessibility_score: avg('accessibility_score'),
        avg_best_practices_score: avg('best_practices_score'),
        avg_seo_score: avg('seo_score'),
        pages: effectivePages as PageSummary[]
    };
}

export function getPageDetails(runId: string, url: string) {
    const db = getDatabase();

    const result = db.prepare(`
     SELECT * 
     FROM results 
     WHERE run_id = ? AND url = ?
   `).get(runId, url) as any;

    if (!result) return null;

    let custom_data = {};
    try {
        custom_data = result.custom_data ? JSON.parse(result.custom_data) : {};
    } catch (e) { }

    let seo_result = null;
    try {
        seo_result = result.seo_result ? JSON.parse(result.seo_result) : null;
    } catch (e) { }

    return {
        ...result,
        a11y_violations: result.a11y_violations ? JSON.parse(result.a11y_violations) : [],
        custom_data,
        seo_result
    };
}

export function getPageViolations(runId: string, url: string) {
    const db = getDatabase();
    // Note: 'results' table contains the full JSON blob with snippets/selectors
    // We usually want the full 'a11y_violations' JSON from the 'results' table for drilldowns.

    const result = db.prepare(`
     SELECT a11y_violations 
     FROM results 
     WHERE run_id = ? AND url = ?
   `).get(runId, url) as any;

    return result ? JSON.parse(result.a11y_violations) : [];
}

export function deleteRun(runId: string): boolean {
    const db = getDatabase();

    try {
        db.transaction(() => {
            // Delete dependent records first to satisfy Foreign Key constraints
            db.prepare('DELETE FROM queue WHERE run_id = ?').run(runId);
            db.prepare('DELETE FROM a11y_findings WHERE run_id = ?').run(runId);
            db.prepare('DELETE FROM performance_findings WHERE run_id = ?').run(runId);
            db.prepare('DELETE FROM results WHERE run_id = ?').run(runId);
            // Delete parent record last
            db.prepare('DELETE FROM runs WHERE id = ?').run(runId);
        })();
        return true;
    } catch (e) {
        console.error(`Failed to delete run ${runId}:`, e);
        return false;
    }
}

export interface PerformanceFindingAggregate {
    audit_id: string;
    title: string;
    description: string;
    affected_pages: number;
    avg_score: number;
    pages: { id: number; url: string; score: number }[];
}

export function getPerformanceFindings(runId: string): PerformanceFindingAggregate[] {
    const db = getDatabase();
    try {
        const stmt = db.prepare(`
            SELECT 
                pf.audit_id,
                pf.title,
                pf.description,
                COUNT(DISTINCT pf.url) as affected_pages,
                AVG(pf.score) as avg_score,
                json_group_array(json_object('id', q.id, 'url', pf.url, 'score', pf.score)) as pages_json
            FROM performance_findings pf
            LEFT JOIN queue q ON pf.run_id = q.run_id AND pf.url = q.url
            WHERE pf.run_id = ? AND (q.duplicate_of IS NULL OR q.duplicate_of = '')
            GROUP BY pf.audit_id
            ORDER BY affected_pages DESC, avg_score ASC
        `);

        const results = stmt.all(runId);

        return results.map((row: any) => ({
            ...row,
            pages: row.pages_json ? JSON.parse(row.pages_json) : []
        }));
    } catch (e) {
        console.error('Error fetching performance findings:', e);
        return [];
    }
}

export interface CommonIssue {
    hash: string;
    audit_id: string;
    title: string;
    description: string;
    identifier: string; // URL, Selector, or Snippet
    identifierType: 'url' | 'node' | 'text';
    count: number;
    potentialSavingsBytes: number;
    potentialSavingsMs: number;
    pages: string[];
}

export function getCommonPerformanceIssues(runId: string): CommonIssue[] {
    const db = getDatabase();
    try {
        // Fetch all raw findings that have details
        const findings = db.prepare(`
            SELECT pf.audit_id, pf.title, pf.description, pf.details_json, pf.url as page_url, q.id as page_id
            FROM performance_findings pf
            JOIN queue q ON pf.run_id = q.run_id AND pf.url = q.url
            WHERE pf.run_id = ? AND pf.details_json IS NOT NULL
        `).all(runId) as { audit_id: string, title: string, description: string, details_json: string, page_url: string, page_id: number }[];

        const issueMap = new Map<string, CommonIssue>();

        for (const finding of findings) {
            try {
                const details = JSON.parse(finding.details_json);
                if (!details.items || !Array.isArray(details.items)) continue;

                for (const item of details.items) {
                    let identifier = null;
                    let type: 'url' | 'node' | 'text' = 'text';

                    // 1. Prioritize URL (Network resources)
                    if (item.url) {
                        identifier = item.url;
                        type = 'url';
                    }
                    // 2. Fallback to Node Selector (DOM elements via generic 'node' property or nested 'node' object)
                    else if (item.node) {
                        identifier = item.node.selector || item.node.snippet;
                        type = 'node';
                    }
                    // 3. Fallback to protocol-relative URLs sometimes found in text
                    else if (typeof item.source?.url === 'string') {
                        identifier = item.source.url;
                        type = 'url';
                    }

                    if (!identifier) continue;

                    // Create a composite key (Audit + Identifier)
                    // We don't strictly need a crypto hash, this string key is sufficient and readable
                    const key = `${finding.audit_id}|${identifier}`;

                    if (!issueMap.has(key)) {
                        issueMap.set(key, {
                            hash: key,
                            audit_id: finding.audit_id,
                            title: finding.title,
                            description: finding.description,
                            identifier,
                            identifierType: type,
                            count: 0,
                            potentialSavingsBytes: 0,
                            potentialSavingsMs: 0,
                            pages: []
                        });
                    }

                    const entry = issueMap.get(key)!;
                    entry.count++;

                    // Sum up potential savings
                    let itemWastedBytes = 0;
                    if (typeof item.wastedBytes === 'number') itemWastedBytes = item.wastedBytes;
                    else if (typeof item.totalBytes === 'number' && !item.wastedBytes) itemWastedBytes = item.totalBytes; // Sometimes total is the savings (e.g. unused JS)

                    let itemWastedMs = 0;
                    if (typeof item.wastedMs === 'number') itemWastedMs = item.wastedMs;

                    entry.potentialSavingsBytes += itemWastedBytes;
                    entry.potentialSavingsMs += itemWastedMs;

                    // Keep track of all affected pages, storing both URL and ID for linking
                    // Format: "ID|URL" to parse later or store as object if possible but interface uses strings for simplicity
                    // Using JSON string to store object {id, url} in the array
                    const pageEntry = JSON.stringify({
                        id: finding.page_id,
                        url: finding.page_url,
                        wastedBytes: itemWastedBytes > 0 ? itemWastedBytes : undefined,
                        wastedMs: itemWastedMs > 0 ? itemWastedMs : undefined
                    });
                    if (!entry.pages.includes(pageEntry)) {
                        entry.pages.push(pageEntry);
                    }
                }
            } catch (e) {
                // Ignore parse errors for individual rows
            }
        }

        // Convert Map to Array and Sort
        // Sorting priority: Count (frequency) -> Savings
        return Array.from(issueMap.values())
            .filter(item => item.count > 1) // Only show repeated issues
            .sort((a, b) => {
                if (b.count !== a.count) return b.count - a.count;
                return b.potentialSavingsBytes - a.potentialSavingsBytes;
            })
            .slice(0, 50); // Top 50

    } catch (e) {
        console.error('Error calculating common performance issues:', e);
        return [];
    }
}


export function getCommonAccessibilityIssues(runId: string): CommonA11yIssue[] {
    const db = getDatabase();
    try {
        // 1. Get stats grouped by rule_id from the lightweight findings table
        // We aggregate the pages as a JSON array of objects: {id, url, count}
        // Note: count in a11y_findings is "instances on that page"
        const stats = db.prepare(`
            SELECT 
                af.rule_id,
                af.impact,
                SUM(af.count) as total_instances,
                COUNT(af.id) as affected_pages_count,
                json_group_array(json_object('id', q.id, 'url', af.url, 'count', af.count)) as pages_json
            FROM a11y_findings af
            LEFT JOIN queue q ON af.run_id = q.run_id AND af.url = q.url
            WHERE af.run_id = ?
            GROUP BY af.rule_id
            ORDER BY 
                CASE af.impact 
                    WHEN 'critical' THEN 1 
                    WHEN 'serious' THEN 2 
                    WHEN 'moderate' THEN 3 
                    WHEN 'minor' THEN 4 
                    ELSE 5 
                END ASC,
                total_instances DESC
        `).all(runId);

        const results: CommonA11yIssue[] = [];

        for (const stat of stats as any[]) {
            // 2. Hydrate title/desc by finding ONE example from the heavy results table
            // We need this because a11y_findings table doesn't store the human-readable text
            const pages = JSON.parse(stat.pages_json);
            const example = pages[0]; // Just take the first one

            if (!example) continue;

            const resRow = db.prepare(`
                SELECT a11y_violations 
                FROM results 
                WHERE run_id = ? AND url = ?
            `).get(runId, example.url) as { a11y_violations: string };

            if (!resRow || !resRow.a11y_violations) continue;

            try {
                const violations = JSON.parse(resRow.a11y_violations);
                const specificViolation = violations.find((v: any) => v.id === stat.rule_id);

                if (specificViolation) {
                    results.push({
                        rule_id: stat.rule_id,
                        description: specificViolation.description,
                        help: specificViolation.help,
                        helpUrl: specificViolation.helpUrl,
                        impact: stat.impact,
                        total_instances: stat.total_instances,
                        affected_pages_count: stat.affected_pages_count,
                        pages: pages
                    });
                } else {
                    // Fallback if not found in JSON (should exist if findings table says so)
                    results.push({
                        rule_id: stat.rule_id,
                        description: "No description available",
                        help: stat.rule_id,
                        impact: stat.impact,
                        total_instances: stat.total_instances,
                        affected_pages_count: stat.affected_pages_count,
                        pages: pages
                    });
                }
            } catch (e) {
                // JSON parse error
            }
        }

        return results;

    } catch (e) {
        console.error('Error fetching a11y issues:', e);
        return [];
    }
}

export function getRunAlerts(runId: string) {
    const db = getDatabase();
    try {
        return db.prepare('SELECT * FROM scan_alerts WHERE run_id = ? ORDER BY created_at DESC').all(runId);
    } catch (e) {
        console.error('Error fetching run alerts:', e);
        return [];
    }
}

