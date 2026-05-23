import Database from "better-sqlite3";
import * as fs from "node:fs";
import * as path from "node:path";

export function getDb(dbPath: string): Database.Database {
  // Ensure directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");

  // Lazy Initialization: Check if our base 'runs' table exists
  const isInitialized = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='runs'",
    )
    .get();
  if (!isInitialized) {
    initializeSchema(db);
  }

  return db;
}

export function initializeSchema(db: Database.Database): void {
  // 1. Create base tables
  try {
    db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      started_at TEXT NOT NULL,
      config_hash TEXT NOT NULL,
      config_json TEXT,
      pid INTEGER,
      status TEXT DEFAULT 'running'
    );
  `);
  } catch (e) {
    console.error("Error creating base tables", e);
    throw e;
  }

  // 2. Apply migrations for existing databases (idempotent)
  try {
    db.prepare("ALTER TABLE runs ADD COLUMN config_json TEXT").run();
  } catch {}
  try {
    db.prepare("ALTER TABLE runs ADD COLUMN pid INTEGER").run();
  } catch {}
  try {
    db.prepare(
      "ALTER TABLE runs ADD COLUMN status TEXT DEFAULT 'running'",
    ).run();
  } catch {}
  try {
    db.prepare("ALTER TABLE runs ADD COLUMN completed_at TEXT").run();
  } catch {}

  // 3. Create remaining tables
  try {
    db.exec(`
    CREATE TABLE IF NOT EXISTS queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      depth INTEGER NOT NULL DEFAULT 0,
      priority INTEGER NOT NULL DEFAULT 0,
      worker_id TEXT,
      FOREIGN KEY (run_id) REFERENCES runs(id),
      UNIQUE(run_id, url)
    );

    CREATE TABLE IF NOT EXISTS results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      url TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      seo_score REAL,
      a11y_violations TEXT,
      custom_data TEXT,
      screenshot_path TEXT,
      page_types TEXT,
      redirect_url TEXT,
      seo_result TEXT,
      FOREIGN KEY (run_id) REFERENCES runs(id)
    );
  `);
  } catch (e) {
    console.error("Error creating queue/results tables", e);
    throw e;
  }

  // Apply migrations for results table
  try {
    db.prepare("ALTER TABLE results ADD COLUMN seo_result TEXT").run();
  } catch {}

  try {
    db.exec(`
    CREATE TABLE IF NOT EXISTS a11y_findings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      url TEXT NOT NULL,
      rule_id TEXT NOT NULL,
      impact TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (run_id) REFERENCES runs(id)
    );

    CREATE TABLE IF NOT EXISTS performance_findings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      url TEXT NOT NULL,
      audit_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      score REAL,
      display_value TEXT,
      details_json TEXT,
      FOREIGN KEY (run_id) REFERENCES runs(id)
    );

    CREATE TABLE IF NOT EXISTS heartbeats (
      worker_id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      last_seen INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scan_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      details_json TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (run_id) REFERENCES runs(id)
    );
  `);
  } catch (e) {
    console.error("Error creating findings tables", e);
    throw e;
  }

  // 4. Queue updates
  try {
    db.prepare(
      "ALTER TABLE queue ADD COLUMN duplicate_of INTEGER DEFAULT NULL REFERENCES queue(id)",
    ).run();
  } catch {}

  // 5. Results updates (Cascading Runner Phase 4)
  try {
    db.prepare("ALTER TABLE results ADD COLUMN page_types TEXT").run();
  } catch {}
  try {
    db.prepare("ALTER TABLE results ADD COLUMN redirect_url TEXT").run();
  } catch {}
}
