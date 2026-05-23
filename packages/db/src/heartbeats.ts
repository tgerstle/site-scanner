import type Database from "better-sqlite3";
import type { WorkerRole } from "@scanner/types";

export function updateHeartbeat(
  db: Database.Database,
  workerId: string,
  role: WorkerRole,
  timestamp: number,
): void {
  const stmt = db.prepare(`
    INSERT INTO heartbeats (worker_id, role, last_seen)
    VALUES (?, ?, ?)
    ON CONFLICT(worker_id) DO UPDATE SET
    role = excluded.role,
    last_seen = excluded.last_seen;
  `);
  stmt.run(workerId, role, timestamp);
}

export function getDeadWorkers(
  db: Database.Database,
  currentTime: number,
  timeoutMs: number = 60000,
): { worker_id: string; role: WorkerRole }[] {
  const stmt = db.prepare(`
    SELECT worker_id, role FROM heartbeats
    WHERE ? - last_seen > ?
  `);
  return stmt.all(currentTime, timeoutMs) as { worker_id: string; role: WorkerRole }[];
}

export function removeHeartbeat(db: Database.Database, workerId: string): void {
  db.prepare("DELETE FROM heartbeats WHERE worker_id = ?").run(workerId);
}

export function resetDeadWorkerJobs(db: Database.Database, workerId: string): void {
  db.prepare(`
    UPDATE queue
    SET status = 'pending', worker_id = NULL
    WHERE worker_id = ? AND status = 'processing'
  `).run(workerId);
}
