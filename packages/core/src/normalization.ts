import type { Database } from "better-sqlite3";
import type { A11yRow, PerformanceRow, SeoRow, GlobalRollupRow } from "@scanner/types";

function safeParse(jsonString: any): any {
    if (typeof jsonString === 'string') {
        try {
            return JSON.parse(jsonString);
        } catch {
            return null;
        }
    }
    return jsonString;
}

export function flattenA11y(db: Database, runId: string): A11yRow[] {
    const rows: A11yRow[] = [];
    const results = db.prepare(`SELECT url, a11y_violations FROM results WHERE run_id = ? AND a11y_violations IS NOT NULL`).all(runId) as any[];

    for (const { url, a11y_violations } of results) {
        const violations = safeParse(a11y_violations);
        if (!Array.isArray(violations)) continue;

        for (const v of violations) {
            if (!v.nodes || !Array.isArray(v.nodes)) continue;

            for (const node of v.nodes) {
                let targetSelector = "Unknown";
                if (node.target) {
                    targetSelector = Array.isArray(node.target) ? node.target.join(' > ') : node.target;
                }

                rows.push({
                    url,
                    impact: v.impact || 'unknown',
                    ruleId: v.id || v.rule_id || 'unknown',
                    help: v.help || '',
                    targetSelector,
                    htmlSnippet: node.html || '',
                    failureSummary: node.failureSummary || '',
                    helpUrl: v.helpUrl || ''
                });
            }
        }
    }

    return rows;
}

export function flattenPerformance(db: Database, runId: string): PerformanceRow[] {
    const rows: PerformanceRow[] = [];
    const findings = db.prepare(`SELECT * FROM performance_findings WHERE run_id = ?`).all(runId) as any[];

    for (const finding of findings) {
        const details = safeParse(finding.details_json);

        // Extract standard metrics
        let potentialSavingsMs = 0;
        let resourceHint = '';

        if (details) {
            if (typeof details.overallSavingsMs === 'number') {
                potentialSavingsMs = Math.round(details.overallSavingsMs);
            }

            // Attempt to find offending resource if available
            if (details.items && Array.isArray(details.items) && details.items.length > 0) {
                const firstItem = details.items[0];
                if (firstItem.url) {
                    resourceHint = firstItem.url;
                } else if (firstItem.node && firstItem.node.snippet) {
                    resourceHint = firstItem.node.snippet;
                }
            }
        }

        rows.push({
            url: finding.url,
            auditId: finding.audit_id,
            title: finding.title || '',
            score: typeof finding.score === 'number' ? finding.score : null,
            displayValue: finding.display_value || '',
            potentialSavingsMs,
            resourceHint,
            description: finding.description || ''
        });
    }

    return rows;
}

export function flattenSeo(db: Database, runId: string): SeoRow[] {
    const rows: SeoRow[] = [];
    const results = db.prepare(`SELECT url, seo_result FROM results WHERE run_id = ? AND seo_result IS NOT NULL`).all(runId) as any[];

    for (const { url, seo_result } of results) {
        const seo = safeParse(seo_result);
        if (!seo || !seo.validation) continue;

        const validation = seo.validation;

        // 1. Meta errors and warnings
        if (validation.meta) {
            for (const err of (validation.meta.errors || [])) {
                rows.push({
                    url,
                    issueType: 'meta',
                    status: 'fail',
                    message: err,
                });
            }
            for (const warn of (validation.meta.warnings || [])) {
                rows.push({
                    url,
                    issueType: 'meta',
                    status: 'warn',
                    message: warn,
                });
            }
        }

        // 2. Schema errors
        if (validation.schema && Array.isArray(validation.schema.errors)) {
            for (const err of validation.schema.errors) {
                rows.push({
                    url,
                    issueType: 'schema',
                    status: 'fail',
                    message: err.message || 'Validation error',
                    schemaType: err.schemaType || '',
                    propertyPath: err.path || ''
                });
            }
        }
    }

    return rows;
}

export function generateGlobalRollup(a11y: A11yRow[], perf: PerformanceRow[], seo: SeoRow[]): GlobalRollupRow[] {
    const rollupMap = new Map<string, GlobalRollupRow>();

    const getMapKey = (plugin: string, ruleId: string) => `${plugin}--${ruleId}`;

    const addOrUpdate = (plugin: string, ruleId: string, severity: string, url: string, description: string) => {
        const key = getMapKey(plugin, ruleId);
        if (!rollupMap.has(key)) {
            rollupMap.set(key, {
                plugin,
                ruleId,
                severity,
                totalOccurrences: 0,
                affectedUrls: 0, // Will calculate unique urls at the end
                description
            });
        }

        const entry = rollupMap.get(key)!;
        entry.totalOccurrences += 1;
        // Temporary hack: we'll store urls in a Set attached to the object, then clean up
        if (!(entry as any)._urls) {
            (entry as any)._urls = new Set<string>();
        }
        (entry as any)._urls.add(url);
    };

    for (const r of a11y) {
        addOrUpdate('axe', r.ruleId, r.impact, r.url, r.help);
    }

    for (const r of perf) {
        // Only rollup failing lighthouse scores (< 0.9 is a standard threshold in the UI but let's just log anything dumped into findings)
        addOrUpdate('lighthouse', r.auditId, 'N/A', r.url, r.title);
    }

    for (const r of seo) {
        // Combine issueType and schemaType if needed, or just let ruleId be the type.
        const id = r.schemaType ? `${r.issueType}-${r.schemaType}` : r.issueType;
        addOrUpdate('seo', id, r.status, r.url, r.message);
    }

    // Resolve Sets
    const rows = Array.from(rollupMap.values());
    for (const row of rows) {
        if ((row as any)._urls) {
            row.affectedUrls = (row as any)._urls.size;
            delete (row as any)._urls;
        }
    }

    // Sort by Occurrences descending
    rows.sort((a, b) => b.totalOccurrences - a.totalOccurrences);

    return rows;
}
