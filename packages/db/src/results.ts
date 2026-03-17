import type { Database } from "better-sqlite3";
import type { AuditResults } from "types";

export interface SaveResultPayload {
  run_id: string;
  url: string;
  results: Partial<AuditResults>;
}

export function saveAuditResult(db: Database, payload: SaveResultPayload) {
  const { run_id, url, results } = payload;

  const insertResult = db.prepare(`
    INSERT INTO results (run_id, url, timestamp, seo_score, a11y_violations, custom_data, screenshot_path, page_types, redirect_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertA11y = db.prepare(`
    INSERT INTO a11y_findings (run_id, url, rule_id, impact, count)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertPerf = db.prepare(`
    INSERT INTO performance_findings (run_id, url, audit_id, title, description, score, display_value, details_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    // 1. Insert main result
    insertResult.run(
      run_id,
      url,
      new Date().toISOString(),
      results.seo_score ?? null,
      results.a11y_violations ? JSON.stringify(results.a11y_violations) : null,
      results.custom_data ? JSON.stringify(results.custom_data) : null,
      results.screenshot_path ?? null,
      results._page_types ? JSON.stringify(results._page_types) : null,
      results._redirect_url ?? null,
    );

    // 2. Insert individual A11y findings
    if (results.a11y_violations && results.a11y_violations.length > 0) {
      for (const violation of results.a11y_violations) {
        insertA11y.run(
          run_id,
          url,
          violation.id,
          violation.impact || "unknown",
          violation.nodes?.length || 1,
        );
      }
    }

    // 3. Insert individual Performance findings
    if (results.performance_findings && results.performance_findings.length > 0) {
      for (const finding of results.performance_findings) {
        insertPerf.run(
          run_id,
          url,
          finding.id,
          finding.title,
          finding.description || null,
          finding.score,
          finding.displayValue || null,
          finding.details ? JSON.stringify(finding.details) : null
        );
      }
    }
  })();
}
