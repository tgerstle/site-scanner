import type { SeoResult } from "@scanner/types";

export interface RunSpecificStats {
    runId: string;
    description: string;
    status: string;
    created_at: string;
    completed_at?: string; // ISO 8601 string
    url: string; // The primary URL or a label

    // Discovery inventory metrics
    discoveredTotal: number;
    discoveredHtml: number;
    discoveredDocuments: number;
    discoveredMedia: number;
    discoveredBinary: number;
    discoveredUnknown: number;

    // Audit execution metrics
    auditedTotal: number;    // completed + failed auditable targets
    auditedCompleted: number;
    auditedFailed: number;
    skippedNonHtml: number;

    // Legacy compatibility fields (deprecated, use split metrics)
    totalUrls: number;
    pendingUrls: number;
    completedUrls: number;
    failedUrls: number;
    stoppedUrls: number;

    totalViolations: number;
}

export type DashboardStats = RunSpecificStats[];

export interface CommonA11yIssue {
    rule_id: string;
    description: string;
    help: string;
    helpUrl?: string;
    impact: string;
    total_instances: number;
    affected_pages_count: number;
    pages: { id: number; url: string; count: number }[];
}

export interface QueueItem {
    id: number;
    url: string;
    status: string;
    run_status?: string;
    depth: number;
    timestamp?: string; // ISO 8601 string
    pageTypes?: string[];
    redirectUrl?: string;
}

export interface RecentItem extends QueueItem {
    violationCount: number;
    timestamp?: string; // ISO 8601 string, overrides QueueItem
}

export interface UrlReport {
    url: string;
    status: string;
    seo_score: number | null;
    violations: any[];
}

export interface RunSummary {
    id: string;
    started_at: string;
    completed_at?: string;
    status: string;
    url_count: number;
    violation_count: number;
    config: any;
    avg_performance_score?: number;
    avg_accessibility_score?: number;
    avg_best_practices_score?: number;
    avg_seo_score?: number;
}

export interface PageSummary {
    url: string;
    status: string;
    depth: number;
    violation_count: number;
    seo_score?: number;
    performance_score?: number;
    accessibility_score?: number;
    best_practices_score?: number;
    pageTypes?: string[];
    redirectUrl?: string;
    seo_result?: SeoResult;

    // Phase 3: Resource metadata from inventory
    resource_type?: "html" | "document" | "media" | "binary" | "unknown";
    audit_disposition?: "auditable_html" | "auditable_document" | "inventory_only" | "deferred";
    skip_reason?: string;
}

export interface RunDetail extends RunSummary {
    pages: PageSummary[];
}
