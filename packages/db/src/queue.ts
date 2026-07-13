import type Database from "better-sqlite3";
<<<<<<< HEAD
import type { QueueRow, WorkerRole, QueueStatus } from "@scanner/types";
=======
import type { AuditDisposition, QueueRow, QueueStatus, ResourceType, WorkerRole } from "types";

export interface InsertJobOptions {
  run_id: string;
  url: string;
  depth: number;
  priority?: number;
  resource_type?: ResourceType;
  audit_disposition?: AuditDisposition;
  skip_reason?: string | null;
  source?: "crawl" | "sitemap" | "manual" | null;
  discovered_from?: string | null;
}

function inferResourceTypeFromUrl(url: string): ResourceType {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith(".html") || pathname.endsWith(".htm")) {
      return "html";
    }

    const lastSegment = pathname.split("/").pop() || "";
    const parts = lastSegment.split(".");
    const extension = parts.length > 1 ? (parts.pop() || "") : "";

    if (!extension) return "unknown";

    if (["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "rtf"].includes(extension)) {
      return "document";
    }

    if (["png", "jpg", "jpeg", "gif", "webp", "svg", "mp4", "webm", "mp3", "wav", "woff", "woff2"].includes(extension)) {
      return "media";
    }

    return "binary";
  } catch {
    return "unknown";
  }
}

function inferDisposition(resourceType: ResourceType): AuditDisposition {
  if (resourceType === "html" || resourceType === "unknown") {
    return "auditable_html";
  }

  if (resourceType === "document") {
    return "auditable_document";
  }

  return "inventory_only";
}
>>>>>>> cf1296b (two tier strategy)

export function claimNextJob(
  db: Database.Database,
  workerId: string,
  role: WorkerRole,
): QueueRow | null {
  // Consolidated Worker: 'audit' role now processes 'pending' jobs directly.
  // We prioritize 'pending' jobs. 
  // Note: We might want to clear 'pending_audit' if we are migrating,
  // but for new runs, everything starts as 'pending'.

  const fromStatus = role === "discovery" ? "pending" : "pending";
  const toStatus = role === "discovery" ? "processing_discovery" : "processing";

  // Grab the highest priority job that matches this role's pending state
  const stmt = db.prepare(`
    UPDATE queue 
    SET status = ?, worker_id = ? 
    WHERE id = (
      SELECT id FROM queue 
      WHERE status = ? 
      ORDER BY priority DESC, id ASC 
      LIMIT 1
    )
    RETURNING *;
  `);

  const result = stmt.get(toStatus, workerId, fromStatus) as QueueRow | undefined;
  return result || null;
}

export function insertJob(
  db: Database.Database,
  job: InsertJobOptions,
): boolean {
  try {
    const stmt = db.prepare(`
      INSERT INTO queue (run_id, url, depth, priority, resource_type, audit_disposition, skip_reason, source, discovered_from)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const resourceType = job.resource_type ?? inferResourceTypeFromUrl(job.url);
    const auditDisposition = job.audit_disposition ?? inferDisposition(resourceType);
    stmt.run(
      job.run_id,
      job.url,
      job.depth,
      job.priority ?? 0,
      resourceType,
      auditDisposition,
      job.skip_reason ?? null,
      job.source ?? null,
      job.discovered_from ?? null,
    );
    return true;
  } catch (error: any) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return false; // Already exists
    }
    throw error;
  }
}
export function updateJobStatus(db: Database.Database, jobId: number, status: QueueStatus): void {
  db.prepare("UPDATE queue SET status = ? WHERE id = ?").run(status, jobId);
}
