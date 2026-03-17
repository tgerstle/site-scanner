export type WorkerRole = "discovery" | "audit";
export type QueueStatus =
    | "pending"
    | "processing_discovery"
    | "pending_audit"
    | "processing_audit"
    | "processing" // Added for consolidated worker
    | "completed"
    | "failed"
    | "stopped";

export interface QueueRow {
    id: number;
    run_id: string;
    url: string;
    status: QueueStatus;
    depth: number;
    priority: number;
    worker_id: string | null;
}
