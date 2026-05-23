import { Page } from "playwright";

/**
 * 
 * Default Scenario
 * 
 * This script runs for every URL unless explicitly disabled by a proprietary scenario.
 * It attempts to handle common "interstitial" patterns using heuristics:
 * 1. Pressing Escape key multiple times
 * 2. Looking for common "Close" buttons
 * 3. Checking for specific library selectors (OneTrust, Cookiebot, etc)
 * 
 */

export const config = {
    description: "Default interstitial cleanup (Esc key + generic selectors)",
    patterns: [/.*/], // Matches everything
    exclusive: false,
};

const GENERIC_SELECTORS = [
    // Common Aria Labels for modals
    'button[aria-label*="close" i]',
    'button[aria-label*="dismiss" i]',
    'button[aria-label*="cookies" i]',
    'div[role="dialog"] button[aria-label="Close"]',

    // Common Class Names
    '.close-modal',
    '.modal-close',
    '.popup-close',
    '.cookie-banner .dismiss',

    // Specific Vendors
    '#onetrust-accept-btn-handler', // OneTrust
    '#onetrust-reject-all-handler', // OneTrust
    '.CybotCookiebotDialogBodyButton', // Cookiebot
    '#close-yotpo-modal' // Generic yotpo close
];

export async function run(page: Page): Promise<void> {
    // 1. Press Escape Key Strategy
    // Tries to close native modals or accessible JS modals
    try {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
        await page.keyboard.press('Escape'); // Second press for nested dialogs
    } catch {
        // Ignore keyboard errors
    }

    // 2. Generic Click Strategy
    // Quickly check if highly common interactive blockers exist and click them
    for (const selector of GENERIC_SELECTORS) {
        try {
            // Use a short timeout so we don't stall the scan if element isn't there
            const element = await page.$(selector);
            if (element && await element.isVisible()) {
                console.log(`[Scenario:Default] Found blocker matching "${selector}". Clicking...`);
                await element.click({ timeout: 1000, force: true });
                await page.waitForTimeout(250); // specific wait for animation
            }
        } catch {
            // Ignore click errors (element might be covered or detached)
        }
    }
}
