import type { AuditContext, AuditPlugin } from "@scanner/types";
import { AxeBuilder } from "@axe-core/playwright";
import * as fs from 'fs';
import * as path from 'path';

export const AxePlugin: AuditPlugin = {
  name: "axe-core",
  async run(ctx: AuditContext) {
    const builder = new AxeBuilder({ page: ctx.page });
    // Use the default rules configuration if none provided
    const rules = ctx.results.pluginArgs?.['axe-core']?.rules;
    if (rules && Array.isArray(rules)) {
      console.log(`[AxePlugin Debug] Running with restricted rules: ${JSON.stringify(rules)}`);
      builder.withRules(rules);
    } else {
      console.log(`[AxePlugin Debug] Running with all rules`);
    }

    // Debug: Dump page content
    const debugDir = path.resolve(process.cwd(), 'debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sanitizedUrl = ctx.page.url().replace(/[^a-z0-9]/gi, '_').substring(0, 50);
    const filenameBase = `axe-debug-${timestamp}-${sanitizedUrl}`;

    try {
      await ctx.page.screenshot({ path: path.join(debugDir, `${filenameBase}.png`), fullPage: true });
      const html = await ctx.page.content();
      fs.writeFileSync(path.join(debugDir, `${filenameBase}.html`), html);
      console.log(`[AxePlugin Debug] Saved debug artifacts to ${path.join(debugDir, filenameBase)}.*`);
    } catch (e) {
      console.error(`[AxePlugin Debug] Failed to save debug artifacts: ${e}`);
    }

    const results = await builder.analyze();
    console.log(`[AxePlugin Debug] Violations found: ${results.violations.length}`);
    console.log(`[AxePlugin Debug] Passes: ${results.passes.length}`);
    console.log(`[AxePlugin Debug] Inapplicable: ${results.inapplicable.length}`);
    console.log(`[AxePlugin Debug] Incomplete: ${results.incomplete.length}`);
    if (results.violations.length > 0) {
      console.log(`[AxePlugin Debug] Violation IDs: ${results.violations.map(v => v.id).join(', ')}`);
    }
    ctx.results.a11y_violations = results.violations;
  },
};
