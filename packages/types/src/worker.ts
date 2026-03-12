import type { WorkerRole } from "./db.js";

export interface HeartbeatMessage {
  type: "heartbeat";
  worker_id: string;
  role: WorkerRole;
  timestamp: number;
}

export interface WorkerStatusMessage {
  type: "status";
  worker_id: string;
  status: "idle" | "working" | "error";
  current_url?: string;
}

export type IPCMessage = HeartbeatMessage | WorkerStatusMessage;
