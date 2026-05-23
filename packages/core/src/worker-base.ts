import type { WorkerRole, IPCMessage } from "@scanner/types";
import { logEvent } from "./logger.js";

const HEARTBEAT_INTERVAL = 30000; // 30 seconds

export class WorkerLoop {
  protected role: WorkerRole;
  protected workerId: string;
  protected heartbeatTimer?: NodeJS.Timeout;

  constructor(role: WorkerRole, workerId: string) {
    this.role = role;
    this.workerId = workerId;
  }

  start() {
    this.sendHeartbeat();
    this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), HEARTBEAT_INTERVAL);
    this.poll();
  }

  stop() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    process.exit(0);
  }

  private sendHeartbeat() {
    if (process.send) {
      const msg: IPCMessage = {
        type: "heartbeat",
        worker_id: this.workerId,
        role: this.role,
        timestamp: Date.now(),
      };
      process.send(msg);
    }
  }

  protected async processJob(): Promise<void> {
    // implemented by subclass
  }

  private async poll() {
    try {
      await this.processJob();
    } catch (e) {
      logEvent({
        event: "worker_error",
        severity: "error",
        message: `Worker ${this.workerId} error`,
        error: String(e),
      });
    }
    setTimeout(() => this.poll(), 5000);
  }
}
