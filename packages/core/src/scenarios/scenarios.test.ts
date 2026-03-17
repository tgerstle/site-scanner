import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runScenario } from './index';
import { Page } from 'playwright';

// --- Mocks ---

// Mocking the page object partially as we only use a few methods
const mockPage = {
    url: vi.fn(),
    goto: vi.fn(),
    $: vi.fn(),
    $$: vi.fn(),
    evaluate: vi.fn(),
    waitForTimeout: vi.fn(),
    keyboard: {
        press: vi.fn(),
    },
    click: vi.fn(),
} as unknown as Page;

// Mock the element handle returned by page.$
const mockElementHandle = {
    isVisible: vi.fn(),
    click: vi.fn(),
} as any;

describe('Scenario System', () => {

    beforeEach(() => {
        vi.clearAllMocks();

        // Default behavior: elements not found
        (mockPage.$ as any).mockResolvedValue(null);
        (mockPage.evaluate as any).mockResolvedValue(''); // Default empty body class
    });

    describe('Scenario Registry (runScenario)', () => {

        it('should run Default scenario for unknown URLs', async () => {
            const logs = await runScenario('https://example.com', mockPage);

            // Should contain logs from default scenario
            expect(logs).toContain('Running Default scenario (escape, generic close buttons)...');
            // Should NOT contain custom scenario logs
            expect(logs).not.toContain('Matched proprietary scenario: Charles & Colvard: Force close Yotpo Modals and cleanup \'aria-hidden\' body.');

            // Verify default actions (Escape key)
            expect(mockPage.keyboard.press).toHaveBeenCalledWith('Escape');
        });

        it('should run Proprietary scenario for matching URLs', async () => {
            // Mock evaluate to return a class so we can verify the check
            (mockPage.evaluate as any).mockResolvedValueOnce('some-class');

            const logs = await runScenario('https://www.charlesandcolvard.com/products/ring', mockPage);

            // Should log match
            expect(logs.some(l => l.includes('Matched proprietary scenario'))).toBe(true);
            // Should log running proprietary
            expect(logs).toContain('Running Proprietary scenario logic...');

            // Since includeDefault is true for Charles & Colvard, it should also run default
            expect(logs).toContain('Running Default scenario (escape, generic close buttons)...');
        });
    });

    describe('Default Scenario', () => {
        it('should press Escape key', async () => {
            await runScenario('https://example.com', mockPage);
            expect(mockPage.keyboard.press).toHaveBeenCalledWith('Escape');
            expect(mockPage.keyboard.press).toHaveBeenCalledTimes(2); // The default presses twice
        });

        it('should click generic close buttons if found', async () => {
            // Mock finding a button
            (mockPage.$ as any).mockResolvedValue(mockElementHandle);
            (mockElementHandle.isVisible as any).mockResolvedValue(true);

            await runScenario('https://example.com', mockPage);

            // Access default scenario (which matches everything)
            // It iterates through GENERIC_SELECTORS.
            // If we mock finding *every* selector as visible, it will try to click all of them.
            // To be more precise, let's just ensure click was called at least once.
            expect(mockElementHandle.click).toHaveBeenCalled();
        });
    });

    describe('Proprietary Scenario: Charles & Colvard', () => {
        it('should attempt to remove body classes', async () => {
            const url = 'https://www.charlesandcolvard.com';
            await runScenario(url, mockPage);

            // Verify evaluate was called (for removing classes)
            expect(mockPage.evaluate).toHaveBeenCalled();
            // We can't easily check the *content* of the evaluate function string/closure without more complex mocking,
            // but ensuring it's called is a good start. 
        });

        it('should click yotpo close button if found', async () => {
            const url = 'https://www.charlesandcolvard.com';

            // Mock the yotpo selector specific match
            // This is tricky because page.$ is called multiple times (for default selectors too).
            // We can mock checking the call arguments.

            (mockPage.$ as any).mockImplementation(async (selector: string) => {
                if (selector === '.yotpo-modal-mask .y-modal-close') {
                    return mockElementHandle;
                }
                return null;
            });
            (mockElementHandle.isVisible as any).mockResolvedValue(true);

            await runScenario(url, mockPage);

            expect(mockElementHandle.click).toHaveBeenCalled();
        });
    });

    describe('Post-Run Checks', () => {
        it('should log warning if body still has modal classes', async () => {
            (mockPage.evaluate as any).mockResolvedValue('modal-open some-other-class');

            const logs = await runScenario('https://example.com', mockPage);

            expect(logs.some(l => l.includes('[WARN] Page body still has suspicious classes'))).toBe(true);
        });
    });

});
