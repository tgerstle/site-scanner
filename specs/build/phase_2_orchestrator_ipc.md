# Phase 2: Orchestrator & Worker IPC

## Overview

This phase builds the Orchestrator, the "dumb" manager responsible for spawning, monitoring, and restarting Node.js child processes (workers). The Orchestrator does not perform audits; it relies entirely on the SQLite database for state and uses Inter-Process Communication (IPC) to receive heartbeats from workers.

## Detailed Checklist

- [ ] **2.1 Worker Entry Point**
  - [ ] Create `packages/core/src/worker.ts` as the entry point for child processes.
  - [ ] Implement a basic event loop that polls the database for work.
- [ ] **2.2 IPC Messaging**
  - [ ] Define typed IPC messages (`HeartbeatMessage`, `StatusMessage`).
  - [ ] Implement heartbeat broadcasting from workers to the parent process.
- [ ] **2.3 Orchestrator Spawning**
  - [ ] Create `packages/core/src/orchestrator.ts`.
  - [ ] Implement `spawnWorker` using `child_process.fork`.
  - [ ] Handle worker exit events (clean exits vs. crashes).
- [ ] **2.4 Zombie Detection & Recovery**
  - [ ] Implement a periodic check in the Orchestrator to find stale heartbeats (> 60s).
  - [ ] Implement logic to reset queue items claimed by dead workers back to `pending`.
  - [ ] Automatically restart dead workers.

## Types & Interfaces

```typescript
// packages/types/src/worker.ts
export type WorkerRole = "discovery" | "audit";

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
```

## Code Example: Worker Spawning & Heartbeat Handling

```typescript
// packages/core/src/orchestrator.ts
import { fork, ChildProcess } from "child_process";
import { IPCMessage, WorkerRole } from "types/worker";
import { updateHeartbeatInDb } from "db/heartbeats";

export class Orchestrator {
  private workers: Map<string, ChildProcess> = new Map();

  spawnWorker(role: WorkerRole, workerId: string) {
    const worker = fork("./dist/worker.js", [role, workerId]);

    worker.on("message", (msg: IPCMessage) => {
      if (msg.type === "heartbeat") {
        updateHeartbeatInDb(msg.worker_id, msg.role, msg.timestamp);
      }
    });

    worker.on("exit", (code) => {
      console.log(`Worker ${workerId} exited with code ${code}`);
      this.workers.delete(workerId);
      // Trigger recovery logic
      this.recoverDeadWorker(workerId, role);
    });

    this.workers.set(workerId, worker);
    return worker;
  }

  private recoverDeadWorker(workerId: string, role: WorkerRole) {
    // 1. Reset queue items claimed by workerId to 'pending'
    // 2. Spawn a new worker to replace it
    this.spawnWorker(role, `${role}-${Date.now()}`);
  }
}
```

## Testing Requirements

- [ ] **Test 2.1**: Orchestrator successfully spawns a child process and receives a heartbeat message.
- [ ] **Test 2.2**: Orchestrator correctly updates the `heartbeats` table in the database upon receiving a heartbeat.
- [ ] **Test 2.3**: Orchestrator detects a simulated dead worker (stale heartbeat > 60s) and resets its claimed queue items to 'pending'.
- [ ] **Test 2.4**: Orchestrator automatically spawns a replacement worker when a child process exits unexpectedly.
