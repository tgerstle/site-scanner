export type LogSeverity = "info" | "warn" | "error" | "debug";

export interface LogEvent {
  event: string;
  plugin?: string;
  url?: string;
  severity: LogSeverity;
  message: string;
  [key: string]: any;
}
