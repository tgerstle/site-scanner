import type { Page } from "playwright";

export interface AuditContext {
  run_id: string;
  url: string;
  page: Page;
  results: Partial<AuditResults>;
  log: (msg: string) => void;
  flags: { hasErrors: boolean };
}

export interface SeoResult {
  meta: {
    title: string | null;
    description: string | null;
    canonical: string | null;
    robots: string | null;
    viewport: string | null;
    charset: string | null;
    generator: string | null;
  };
  openGraph: Record<string, string>;
  twitter: Record<string, string>;
  jsonLd: Array<Record<string, any>>;
  headings: Array<{ level: number; text: string }>;
  images: Array<{ src: string; alt: string; loading?: string }>;
  validation?: SeoValidationResult; // Added in Phase 2
}

export interface SeoValidationResult {
  meta: {
    status: "pass" | "warn" | "fail";
    errors: string[];
    warnings: string[];
  };
  schema: {
    valid: boolean;
    errors: Array<{
      path: string | null;
      message: string;
      schemaType: string;
    }>;
  };
  score: number;
}

export interface AuditResults {
  seo_score?: number;
  a11y_violations?: any[];
  performance_findings?: any[];
  custom_data?: Record<string, any>;
  screenshot_path?: string;
  _page_types?: string[];
  _redirect_url?: string;
  seo_result?: SeoResult;
  pluginArgs?: Record<string, any>;
}

// Phase 4: Document audit support
export interface DocumentAuditContext {
  run_id: string;
  url: string;
  contentType?: string;
  results: Partial<AuditResults>;
  log: (msg: string) => void;
  flags: { hasErrors: boolean };
}

export interface AuditPlugin {
  name: string;
  targets?: Array<"html" | "document" | "all">;
  run(ctx: AuditContext | DocumentAuditContext, options?: Record<string, any>): Promise<void>;
}
