
import Database from 'better-sqlite3';
import { analyzeRun } from './packages/core/dist/post-scan.js';
import fs from 'fs';

const DB_PATH = './test_flag.db';
if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

const db = new Database(DB_PATH);

// Setup schema
db.exec(`
    CREATE TABLE IF NOT EXISTS queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT,
        url TEXT,
        status TEXT,
        duplicate_of INTEGER
    );
    CREATE TABLE IF NOT EXISTS results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT,
        url TEXT,
        data TEXT,
        custom_data TEXT
    );
    CREATE TABLE IF NOT EXISTS scan_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT,
        type TEXT,
        message TEXT,
        details_json TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

const RUN_ID = 'run_test_123';

// Insert duplicates
db.prepare("INSERT INTO queue (run_id, url, status) VALUES (?, ?, 'completed')").run(RUN_ID, 'http://example.com/foo');
db.prepare("INSERT INTO queue (run_id, url, status) VALUES (?, ?, 'completed')").run(RUN_ID, 'http://example.com/foo/'); // Trailing slash

// Insert results
db.prepare("INSERT INTO results (run_id, url, custom_data) VALUES (?, ?, ?)").run(RUN_ID, 'http://example.com/foo', JSON.stringify({ performance_score: 50 }));
db.prepare("INSERT INTO results (run_id, url, custom_data) VALUES (?, ?, ?)").run(RUN_ID, 'http://example.com/foo/', JSON.stringify({ performance_score: 0 }));

console.log('Running analysis...');
analyzeRun(db, RUN_ID);

console.log('Verifying Alerts...');
const alerts = db.prepare("SELECT * FROM scan_alerts WHERE run_id = ?").all(RUN_ID);
console.log('Alerts found:', alerts.length);
if (alerts.length > 0) {
    console.log('Alert Type:', alerts[0].type);
    console.log('Alert Message:', alerts[0].message);
}

console.log('Verifying Queue Modification (Should be NONE)...');
const queueItems = db.prepare("SELECT * FROM queue WHERE run_id = ?").all(RUN_ID);
const modifications = queueItems.filter(q => q.duplicate_of !== null);
console.log('Rows modified (merged):', modifications.length);

if (alerts.length === 1 && modifications.length === 0) {
    console.log('SUCCESS: Logic is correct (Flag only, no merge).');
} else {
    console.log('FAILURE: Logic mismatch.');
}

db.close();
fs.unlinkSync(DB_PATH);
