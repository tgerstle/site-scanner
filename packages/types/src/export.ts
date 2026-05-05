export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

// Tab 1: Axe
export interface A11yRow {
    url: string;
    impact: string;
    ruleId: string;
    help: string;
    targetSelector: string; // The DOM node path
    htmlSnippet: string;    // The failing code
    failureSummary: string; // Explanation of the fix needed
    helpUrl: string;
}

// Tab 2: Lighthouse
export interface PerformanceRow {
    url: string;
    auditId: string;
    title: string;
    score: number | null;
    displayValue: string;        // e.g. "1.2 s"
    potentialSavingsMs: number;  // Extracted from details for sorting
    resourceHint: string;        // e.g., URL of an unoptimized image
    description: string;
}

// Tab 3: Custom SEO
export interface SeoRow {
    url: string;
    issueType: 'meta' | 'schema' | 'opportunity';
    status: 'fail' | 'warn' | 'info';
    message: string;
    schemaType?: string; // If applicable
    propertyPath?: string; // e.g., 'offers.price'
}

// Tab 4: Global Rollup
export interface GlobalRollupRow {
    plugin: string; // 'axe', 'lighthouse', 'seo'
    ruleId: string;
    severity: SeverityLevel | string;
    totalOccurrences: number;
    affectedUrls: number;
    description: string;
}

export interface ExportDatasets {
    global: GlobalRollupRow[];
    a11y: A11yRow[];
    performance: PerformanceRow[];
    seo: SeoRow[];
}
