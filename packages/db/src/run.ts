import type { Database } from "better-sqlite3";
import * as crypto from "node:crypto";

export function createRun(db: Database, config: any): string {
    const runId = `run_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const configHash = crypto.createHash("sha256").update(JSON.stringify(config)).digest("hex");
    const pid = process.pid;

    // Add columns dynamically if running against old DB
    try {
        db.exec("ALTER TABLE runs ADD COLUMN config_json TEXT;");
    } catch (e) { }
    try {
        db.exec("ALTER TABLE runs ADD COLUMN pid INTEGER;");
    } catch (e) { }
    try {
        db.exec("ALTER TABLE runs ADD COLUMN status TEXT DEFAULT 'running';");
    } catch (e) { }

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
