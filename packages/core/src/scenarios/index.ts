// The "Scenario Registry" handles running custom interaction scripts for specific sites.
// It matches the current URL against available scenarios and executes them before auditing.

import { Page } from "playwright";
import * as DefaultScenario from "./default.js";
import * as CharlesAndColvard from "./proprietary/charlesandcolvard.js";
import { ScenarioModule } from "./types.js";

// Define the available scenarios manually here.
// In the future, this could be dynamic, but explicit imports are safer for bundling.
const scenarios: ScenarioModule[] = [
    CharlesAndColvard,
    // Add new proprietary modules here:
    // SomeOtherClient,
];

/**
 * Executes the appropriate scenario(s) for the given URL.
 * 
 * Logic:
 * 1. Find the FIRST matching proprietary scenario.
 * 2. If config.exclusive is true, run ONLY that scenario.
 * 3. Else, run DefaultScenario first, THEN the custom scenario.
 * 4. Checks for basic "Obstruction" signals after running.
 */
export async function runScenario(url: string, page: Page): Promise<string[]> {
    const logs: string[] = [];

    // Find custom match
    let customScenario: ScenarioModule | null = null;
    for (const mod of scenarios) {
        if (mod.config.patterns.some((pattern: string | RegExp) => typeof pattern === 'string' ? url.includes(pattern) : pattern.test(url))) {
            customScenario = mod;
            logs.push(`Matched proprietary scenario: ${mod.config.description || 'Custom'}`);
            break;
        }
    }

    // Determine execution plan
    const shouldRunDefault = !customScenario || (customScenario.config.includeDefault !== false && !customScenario.config.exclusive);

    // Execute Default
    if (shouldRunDefault) {
        logs.push("Running Default scenario (escape, generic close buttons)...");
        try {
            await DefaultScenario.run(page);
        } catch (e: any) {
            logs.push(`Default scenario failed: ${e.message}`);
        }
    }

    // Execute Custom
    if (customScenario) {
        logs.push("Running Proprietary scenario logic...");
        try {
            await customScenario.run(page);
        } catch (e: any) {
            logs.push(`Custom scenario failed: ${e.message}`);
        }
    }

    // Post-Run Check: Log potential issues
    try {
        const bodyClass = await page.evaluate(() => document.body.className);
        if (bodyClass.includes("modal-open") || bodyClass.includes("overflow-hidden")) {
            logs.push(`[WARN] Page body still has suspicious classes after cleanup: "${bodyClass}"`);
        }
    } catch {
        // Ignore evaluation errors
    }

    return logs;
}
