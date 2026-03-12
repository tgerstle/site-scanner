import type Database from "better-sqlite3";
import type { QueueRow, WorkerRole, QueueStatus } from "types";

export function claimNextJob(
  db: Database.Database,
  workerId: string,
  role: WorkerRole,
): QueueRow | null {
  const fromStatus = role === "discovery" ? "pending" : "pending_audit";
  const toStatus = role === "discovery" ? "processing_discovery" : "processing_audit";

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
  job: { run_id: string; url: string; depth: number; priority?: number },
): boolean {
  try {
    const stmt = db.prepare(`
      INSERT INTO queue (run_id, url, depth, priority)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(job.run_id, job.url, job.depth, job.priority ?? 0);
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
