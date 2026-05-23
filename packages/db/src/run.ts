import type { Database } from "better-sqlite3";
import * as crypto from "node:crypto";

export function createRun(db: Database, config: any): string {
    const runId = `run_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const configHash = crypto.createHash("sha256").update(JSON.stringify(config)).digest("hex");
    const pid = process.pid;

    // Add columns dynamically if running against old DB
    try {
        db.exec("ALTER TABLE runs ADD COLUMN config_json TEXT;");
    } catch { }
    try {
        db.exec("ALTER TABLE runs ADD COLUMN pid INTEGER;");
    } catch { }
    try {
        db.exec("ALTER TABLE runs ADD COLUMN status TEXT DEFAULT 'running';");
    } catch { }

    db.prepare(`
        INSERT INTO runs (id, started_at, config_hash, config_json, pid, status) 
        VALUES (?, ?, ?, ?, ?, 'running')
    `).run(runId, new Date().toISOString(), configHash, JSON.stringify(config), pid);

    return runId;
}

export function getRunConfig(db: Database, runId: string): any {
    const row = db.prepare("SELECT config_json FROM runs WHERE id = ?").get(runId) as any;
    if (row && row.config_json) {
        return JSON.parse(row.config_json);
    }
    return {};
}

export function stopRun(db: Database, runId: string): void {
    // 1. Mark run as stopped
    db.prepare("UPDATE runs SET status = 'stopped', completed_at = ? WHERE id = ?").run(
        new Date().toISOString(),
        runId
    );

    // 2. Mark pending/processing jobs as stopped
    db.prepare(`
        UPDATE queue 
        SET status = 'stopped' 
        WHERE run_id = ? 
        AND status IN ('pending', 'processing', 'processing_discovery', 'pending_audit', 'processing_audit', 'running')
    `).run(runId);
}
