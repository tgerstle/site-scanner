import type { Page } from "playwright";

export interface AuditContext {
  run_id: string;
  url: string;
  page: Page;
  results: Partial<AuditResults>;
  log: (msg: string) => void;
  flags: { hasErrors: boolean };
}

export interface AuditResults {
  seo_score?: number;
  a11y_violations?: any[];
  performance_findings?: any[];
  custom_data?: Record<string, any>;
  screenshot_path?: string;
  _page_types?: string[];
  _redirect_url?: string;
  pluginArgs?: Record<string, any>;
}

export interface AuditPlugin {
  name: string;
  run(ctx: AuditContext, options?: Record<string, any>): Promise<void>;
}
