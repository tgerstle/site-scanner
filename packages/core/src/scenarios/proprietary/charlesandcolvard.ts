// Specialized interstitial logic for Charles and Colvard (Yotpo Modals)
import { Page } from "playwright";

/**
 * Handle Yotpo Reviews and modals.
 *
 * Current issues:
 * - "fc-modal-open" class persisted on body causing "aria-hidden".
 * - Yotpo widget uses non-standard "Close" buttons.
 */
export const config = {
    patterns: [/charlesandcolvard\.com/, /staging\.charlesandcolvard\.com/],
    description: "Charles & Colvard: Force close Yotpo Modals and cleanup 'aria-hidden' body.",
    includeDefault: true,
};

export async function run(page: Page): Promise<void> {

    // 1. Force remove "fc-modal-open" class
    // This is the direct fix for the aria-hidden-focus violation we saw.
    await page.evaluate(() => {
        document.body.classList.remove("fc-modal-open", "modal-active", "yotpo-active");

        // Sometimes removing the class isn't enough if styles are inline
        document.body.style.overflow = "auto";
        document.body.removeAttribute("aria-hidden");

        const mainContent = document.getElementById("main-content") || document.querySelector("main");
        if (mainContent) {
            mainContent.removeAttribute("aria-hidden");
        }
    });

    // 2. Look for the specific Yotpo "X" button
    // The debug HTML showed: <div class="yotpo-modal-mask"> <div class="y-modal-close"> ...
    const yotpoClose = await page.$('.yotpo-modal-mask .y-modal-close');
    if (yotpoClose && await yotpoClose.isVisible()) {
        await yotpoClose.click();
        await page.waitForTimeout(500);
    }
}
