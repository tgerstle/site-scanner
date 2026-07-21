import type { WorkerRole, IPCMessage, ScannerConfig } from "@scanner/types";
import { logEvent } from "./logger.js";

const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const IDLE_FLOOR_MS = 250; // minimum sleep when no job was claimed, regardless of throttleMs

export class WorkerLoop {
  protected role: WorkerRole;
  protected workerId: string;
  protected config: ScannerConfig;
  protected heartbeatTimer?: NodeJS.Timeout;

  constructor(role: WorkerRole, workerId: string, config: ScannerConfig) {
    this.role = role;
    this.workerId = workerId;
    this.config = config;
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

  /**
   * Implemented by subclass. Returns true if a job was claimed/processed, false if the
   * queue was empty — the loop uses this to apply the idle floor instead of throttleMs.
   */
  protected async processJob(): Promise<boolean> {
    return false;
  }

  /**
   * Pure, testable delay calculator.
   * - No job claimed => fixed IDLE_FLOOR_MS (cheap polling, ignores throttleMs so
   *   throttleMs:0 does not busy-spin an empty queue).
   * - Job processed => throttleMs +/- throttleJitter%, never negative.
   */
  protected computeDelay(didWork: boolean): number {
    if (!didWork) return IDLE_FLOOR_MS;
    const baseDelay = this.config.throttleMs ?? 5000;
    const jitterFactor = (this.config.throttleJitter ?? 0) / 100;
    const jitter = baseDelay * jitterFactor * (Math.random() * 2 - 1); // +/- range
    return Math.max(0, baseDelay + jitter);
  }

  private async poll() {
    let didWork = false;
    try {
      didWork = await this.processJob();
    } catch (e) {
      logEvent({
        event: "worker_error",
        severity: "error",
        message: `Worker ${this.workerId} error`,
        error: String(e),
      });
    }
    setTimeout(() => this.poll(), this.computeDelay(didWork));
  }
}
