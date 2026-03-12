import { describe, expect, it } from "vitest";
import { logEvent } from "./logger.js";

describe("Logger", () => {
  it("outputs valid JSON strings with required fields", () => {
    let captured = "";
    const mockStream = {
      write: (str: string) => {
        captured += str;
        return true;
      },
    };

    logEvent(
      {
        event: "test_event",
        severity: "info",
        message: "Hello World",
      },
      mockStream as any,
    );

    const parsed = JSON.parse(captured);
    expect(parsed.event).toBe("test_event");
    expect(parsed.severity).toBe("info");
    expect(parsed.message).toBe("Hello World");
    expect(parsed.timestamp).toBeDefined();
    expect(Date.parse(parsed.timestamp)).not.toBeNaN();
    expect(captured.endsWith("\n")).toBe(true);
  });
});
