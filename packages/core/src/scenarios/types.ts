import { Page } from "playwright";

export interface ScenarioConfig {
    /**
     * Array of regex patterns or strings to match the URL.
     * If a URL matches one of these, this scenario will be selected.
     */
    patterns: (RegExp | string)[];

    /**
     * If true, the default cleanup logic (Escape key, common selectors)
     * will run BEFORE this scenario's custom logic.
     * Default: true
     */
    includeDefault?: boolean;

    /**
     * If true, this scenario is the ONLY one that runs (skips default).
     * Same as setting includeDefault: false.
     */
    exclusive?: boolean;

    /**
     * Optional description of what this scenario handles.
     */
    description?: string;
}

export interface ScenarioModule {
    config: ScenarioConfig;
    run: (page: Page) => Promise<void>;
}

export interface ScenarioResult {
    name: string;
    actionTaken: boolean;
    logs: string[];
}
