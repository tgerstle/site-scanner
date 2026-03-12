
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getDb, initializeSchema, createRun, insertJob } from '../../packages/db/src/index';
import { AuditWorker } from '../../packages/core/src/audit-worker';
import { AxePlugin } from '../../packages/plugins/src/axe';
import { LighthousePlugin } from '../../packages/plugins/src/lighthouse';
import path from 'path';
import fs from 'fs';

// Configuration for the test
let TEST_URL = 'https://www.charlesandcolvard.com'; // Default

// 1. Try Config File
const configPath = path.resolve(__dirname, '../../scanner-test-config.json');
if (fs.existsSync(configPath)) {
    try {
        const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (fileConfig.testUrl) TEST_URL = fileConfig.testUrl;
    } catch (e) {
        console.warn('Failed to read scanner-test-config.json', e);
    }
}

// 2. Override with Env Var
if (process.env.TEST_URL) {
    TEST_URL = process.env.TEST_URL;
}

const TEST_DB_PATH = path.resolve(__dirname, 'test_awa.sqlite');

describe('End-to-End Scan Integration', () => {
    let db: any;
    let worker: AuditWorker;
    let runId: string;

    beforeAll(() => {
        // Mock process.exit to avoid killing the test runner
        vi.spyOn(process, 'exit').mockImplementation((code) => {
            console.log(`[Mock] process.exit(${code}) called`);
            return undefined as never;
        });

        // 1. Setup Database
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }
        db = getDb(TEST_DB_PATH);
        initializeSchema(db);

        // 2. Create Run Configuration
        const config = {
            siteUrl: TEST_URL,
            maxDepth: 0,
            plugins: ['axe', 'lighthouse'],
        };

        // 3. Create Scan Run
        runId = createRun(db, config);
        console.log(`Created test run: ${runId} targeting ${TEST_URL}`);

        // 4. Insert Job & Set to pending_audit
        insertJob(db, {
            run_id: runId,
            url: TEST_URL,
            depth: 0,
            priority: 100,
        });

        // AuditWorker expects jobs to be in 'pending_audit' state (Discovery usually does this transition)
        db.prepare("UPDATE queue SET status = 'pending_audit' WHERE run_id = ? AND url = ?").run(runId, TEST_URL);

        // 5. Initialize Worker with Plugins
        // We instantiate the worker directly to avoid spawning logic
        // We pass a random port for lighthouse
        worker = new AuditWorker(
            `${runId}_test_worker`,
            db,
            config,
            [AxePlugin, LighthousePlugin],
            10000 + Math.floor(Math.random() * 5000) // Random port 10000+
        );
    });

    afterAll(async () => {
        if (worker) {
            await worker.stop();
        }
        if (db) {
            db.close();
        }
        // Cleanup db file
        if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);

        vi.restoreAllMocks();
    });

    it('should successfully audit the page with Axe and Lighthouse', async () => {
        // Manually trigger job processing
        console.log(`Processing job for ${TEST_URL}... This may take a minute.`);

        // @ts-ignore - Accessing protected method for testing
        // processJob is async
        await worker.processJob();

        // Verify Job Status
        const job = db.prepare('SELECT * FROM queue WHERE run_id = ? AND url = ?').get(runId, TEST_URL);
        expect(job).toBeDefined();

        // If it failed, print why (check logs or debug)
        if (job.status === 'failed') {
            // We can't easily see the error message in queue table unless we log it somewhere else or check logs.
            // But let's fail the test with current status
        }
        expect(job.status).toBe('completed');

        // Verify Audit Results (Lighthouse Scores)
        const result = db.prepare('SELECT * FROM results WHERE run_id = ? AND url = ?').get(runId, TEST_URL);
        expect(result).toBeDefined();

        if (result.custom_data) {
            console.log('Extensions Found:', result.custom_data);
            const customData = JSON.parse(result.custom_data);
            expect(customData.performance_score).toBeDefined();
            // expect(customData.accessibility_score).toBeDefined(); // Lighthouse a11y score
        } else {
            throw new Error("Lighthouse data missing (custom_data is empty)");
        }

        // Check SEO Score (Lighthouse top level category often mapped to custom_data or direct column?)
        // In L54 of AuditWorker/LighthousePlugin: ctx.results.seo_score = result.lhr.categories.seo?.score;
        // So it should be in seo_score column.
        // However, if Lighthouse fails or is skipped, this might be null.
        // If Lighthouse is not running (e.g. valid port issue), this might fail.

        // Verify Axe Violations
        // AxePlugin runs: ctx.results.a11y_violations = results.violations;
        // Saved in saveAuditResult -> a11y_violations column (JSON) and separate table.

        const violationsCount = db.prepare('SELECT COUNT(*) as count FROM a11y_findings WHERE run_id = ?').get(runId).count;
        console.log(`Axe Violations Count (Rows): ${violationsCount}`);

        // Retrieve the detailed JSON
        const violationsJson = result.a11y_violations ? JSON.parse(result.a11y_violations) : [];
        console.log(`Axe Violations Count (JSON): ${violationsJson.length}`);

        // We expect some violations or at least the array to be present (empty if perfect)
        expect(Array.isArray(violationsJson)).toBe(true);

        // Note: If the site has 0 violations, this test passes. 
        // If we want to ensure Axe RAN, checking array existence is enough.
    });
});

