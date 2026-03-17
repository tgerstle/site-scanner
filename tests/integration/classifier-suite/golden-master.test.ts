import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PageClassifier } from '../../../packages/core/src/classifier';
import { DEFAULT_CONFIG } from '../../../packages/core/src/default-config';
import { setupFastContext } from '../../../packages/core/src/discovery';
import * as fs from 'fs';
import * as path from 'path';
import type { Browser, BrowserContext } from 'playwright';

// Load Golden Manifest
const MANIFEST_PATH = path.join(__dirname, 'golden.json');
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));

describe('Golden Master Classifier Suite', () => {
    let browser: Browser;
    let context: BrowserContext;
    let classifier: PageClassifier;

    beforeAll(async () => {
        // reuse fast context setup
        const setup = await setupFastContext();
        browser = setup.browser;
        context = setup.context;

        // Use ONLY default config for strict regression testing
        // Any change to default config will break this test -> intended!
        classifier = new PageClassifier(DEFAULT_CONFIG as any);
    });

    afterAll(async () => {
        if (browser) await browser.close();
    });

    Object.entries(manifest).forEach(([filename, testCase]: [string, any]) => {
        it(`should classify ${filename} as ${JSON.stringify(testCase.expectedTypes)}`, async () => {
            const fixturePath = path.join(__dirname, 'fixtures', filename);
            if (!fs.existsSync(fixturePath)) {
                throw new Error(`Fixture not found: ${fixturePath}`);
            }

            const html = fs.readFileSync(fixturePath, 'utf-8');
            const page = await context.newPage();

            // Simulate the content
            await page.setContent(html);

            // Pass the simulated URL (for regex matching)
            const result = await classifier.classify(testCase.url, page);

            // Sort both for consistent comparison
            const sortedResult = result.sort();
            const sortedExpectation = testCase.expectedTypes.sort();

            expect(sortedResult).toEqual(sortedExpectation);

            await page.close();
        }, 10000); // 10s timeout per case
    });
});