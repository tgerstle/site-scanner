import { describe, it, expect } from "vitest";
import { WorkerLoop } from "./worker-base.js";
import type { ScannerConfig } from "@scanner/types";

// Expose the protected computeDelay for testing.
class TestLoop extends WorkerLoop {
  public delay(didWork: boolean): number {
    return this.computeDelay(didWork);
  }
}

function makeConfig(partial: Partial<ScannerConfig>): ScannerConfig {
  return { throttleMs: 5000, throttleJitter: 10, ...partial } as ScannerConfig;
}

describe("WorkerLoop.computeDelay", () => {
  it("returns the fixed idle floor when no job was claimed, ignoring throttleMs", () => {
    const loop = new TestLoop("audit", "w1", makeConfig({ throttleMs: 0, throttleJitter: 0 }));
    expect(loop.delay(false)).toBe(250);

    const loopHigh = new TestLoop("audit", "w2", makeConfig({ throttleMs: 60000, throttleJitter: 50 }));
    expect(loopHigh.delay(false)).toBe(250);
  });

  it("returns exactly throttleMs when jitter is 0 and a job was processed", () => {
    const loop = new TestLoop("audit", "w1", makeConfig({ throttleMs: 3000, throttleJitter: 0 }));
    expect(loop.delay(true)).toBe(3000);
  });

  it("keeps jittered delay within +/- jitter% and never negative", () => {
    const loop = new TestLoop("audit", "w1", makeConfig({ throttleMs: 1000, throttleJitter: 10 }));
    for (let i = 0; i < 1000; i++) {
      const d = loop.delay(true);
      expect(d).toBeGreaterThanOrEqual(900);
      expect(d).toBeLessThanOrEqual(1100);
      expect(d).toBeGreaterThanOrEqual(0);
    }
  });

  it("allows throttleMs:0 for instant back-to-back processing", () => {
    const loop = new TestLoop("audit", "w1", makeConfig({ throttleMs: 0, throttleJitter: 0 }));
    expect(loop.delay(true)).toBe(0);
  });
});
