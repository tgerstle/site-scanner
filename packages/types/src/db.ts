export type WorkerRole = "discovery" | "audit";
export type ResourceType = "html" | "document" | "media" | "binary" | "unknown";
export type AuditDisposition = "auditable_html" | "auditable_document" | "inventory_only" | "deferred";
export type QueueStatus =
    | "pending"
    | "processing_discovery"
    | "pending_audit"
    | "processing_audit"
    | "processing" // Added for consolidated worker
    | "completed"
    | "failed"
    | "skipped_non_html"
    | "stopped";

export interface QueueRow {
    id: number;
    run_id: string;
    url: string;
    status: QueueStatus;
    depth: number;
    priority: number;
    worker_id: string | null;
    resource_type?: ResourceType;
    audit_disposition?: AuditDisposition;
    skip_reason?: string | null;
    source?: "crawl" | "sitemap" | "manual" | null;
    discovered_from?: string | null;
}
