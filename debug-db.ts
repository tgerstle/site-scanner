import { getDb } from './packages/db/src/connection.ts';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'data/awa.sqlite');
console.log(`Checking DB at: ${dbPath}`);
const db = getDb(dbPath);

try {
    const count = db.prepare('SELECT COUNT(*) as c FROM queue').get().c;
    console.log(`Queue count: ${count}`);
} catch (e) {
    console.log(`Error reading queue: ${e.message}`);
}
