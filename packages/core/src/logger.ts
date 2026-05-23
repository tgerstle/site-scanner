import type { LogEvent } from "@scanner/types";
import * as fs from "node:fs";
import * as path from "node:path";

export function logEvent(event: LogEvent, stream = process.stdout) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    ...event,
  };
  const logLine = JSON.stringify(logEntry) + "\n";
  stream.write(logLine);

  try {
    let logPath = process.env.AWA_LOG_PATH || path.resolve(process.cwd(), "scanner_run.log");
    if (!process.env.AWA_LOG_PATH && process.env.AWA_DB_PATH) {
      logPath = path.join(path.dirname(process.env.AWA_DB_PATH), "scanner_run.log");
    }
    fs.appendFileSync(logPath, logLine);
  } catch (e) {
    // Safe fail
  }
}
