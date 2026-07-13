import type { LogEvent } from "@scanner/types";
import * as fs from "node:fs";
import * as path from "node:path";
import type Database from "better-sqlite3";

export function logEvent(event: LogEvent, stream = process.stdout) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    ...event,
  };
  const logLine = JSON.stringify(logEntry) + "\n";
  stream.write(logLine);

  try {
    let logPath = process.env.AWA_LOG_PATH || path.resolve(process.cwd(), "scanner_run.log");
    if (!process.env.AWA_LOG_PATH && process.env.AWA_DB_PATH) {
      logPath = path.join(path.dirname(process.env.AWA_DB_PATH), "scanner_run.log");
    }
    fs.appendFileSync(logPath, logLine);
  } catch {
    // Safe fail
  }
}

/**
 * Phase 5: Log operational counters for a run.
 * Called at end of scan to report discovery/audit metrics.
 */
export function logRunMetrics(
  db: Database.Database,
  runId: string,
  stream = process.stdout
): void {
  try {
    const metrics = db
      .prepare(
        `
        SELECT
          COUNT(*) as discovered_total,
          SUM(CASE WHEN resource_type = 'html' THEN 1 ELSE 0 END) as discovered_html,
          SUM(CASE WHEN resource_type = 'document' THEN 1 ELSE 0 END) as discovered_documents,
          SUM(CASE WHEN resource_type = 'media' THEN 1 ELSE 0 END) as discovered_media,
          SUM(CASE WHEN resource_type = 'binary' THEN 1 ELSE 0 END) as discovered_binary,
          SUM(CASE WHEN resource_type = 'unknown' OR resource_type IS NULL THEN 1 ELSE 0 END) as discovered_unknown,
          SUM(CASE WHEN audit_disposition IN ('auditable_html','auditable_document') AND status = 'completed' THEN 1 ELSE 0 END) as audited_completed,
          SUM(CASE WHEN audit_disposition IN ('auditable_html','auditable_document') AND status = 'failed' THEN 1 ELSE 0 END) as audited_failed,
          SUM(CASE WHEN status = 'skipped_non_html' THEN 1 ELSE 0 END) as skipped_non_html,
          SUM(CASE WHEN audit_disposition = 'auditable_document' AND status = 'completed' THEN 1 ELSE 0 END) as document_audits_completed
        FROM queue
        WHERE run_id = ?
      `
      )
      .get(runId) as any;

    logEvent(
      {
        event: "run_metrics",
        severity: "info",
        message: "Run completion metrics",
        runId,
        data: {
          discovered: {
            total: metrics.discovered_total || 0,
            html: metrics.discovered_html || 0,
            documents: metrics.discovered_documents || 0,
            media: metrics.discovered_media || 0,
            binary: metrics.discovered_binary || 0,
            unknown: metrics.discovered_unknown || 0,
          },
          audited: {
            completed: metrics.audited_completed || 0,
            failed: metrics.audited_failed || 0,
            document_completed: metrics.document_audits_completed || 0,
          },
          skipped: {
            non_html: metrics.skipped_non_html || 0,
          },
        },
      },
      stream
    );
  } catch (e: any) {
    logEvent(
      {
        event: "worker_warning",
        severity: "warn",
        message: `Failed to compute run metrics: ${e.message}`,
        runId,
      },
      stream
    );
  }
}
