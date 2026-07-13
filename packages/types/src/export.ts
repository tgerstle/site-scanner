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

// Phase 3: Resource Inventory Tab
export interface ResourceInventoryRow {
    url: string;
    resource_type: "html" | "document" | "media" | "binary" | "unknown";
    audit_disposition: "auditable_html" | "auditable_document" | "inventory_only" | "deferred";
    status: string;
    skip_reason?: string;
    discovered_from?: string; // URL that linked to this resource
    source: "manual" | "sitemap" | "crawl"; // How it was discovered
}

// Phase 3: Audit Target Summary Tab
export interface AuditTargetSummaryRow {
    url: string;
    resource_type: "html" | "document" | "media" | "binary" | "unknown";
    audit_disposition: "auditable_html" | "auditable_document" | "inventory_only" | "deferred";
    audit_status: string; // completed | failed | skipped_non_html | pending | processing
    violation_count: number;
    seo_score?: number;
    performance_score?: number;
    accessibility_score?: number;
    best_practices_score?: number;
}

export interface ExportDatasets {
    global: GlobalRollupRow[];
    a11y: A11yRow[];
    performance: PerformanceRow[];
    seo: SeoRow[];
    // Phase 3: Split inventory and audit target datasets
    resource_inventory?: ResourceInventoryRow[];
    audit_target_summary?: AuditTargetSummaryRow[];
}
