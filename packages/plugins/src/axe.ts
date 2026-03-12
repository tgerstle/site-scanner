import type { AuditContext, AuditPlugin } from "types";
import { AxeBuilder } from "@axe-core/playwright";

export const AxePlugin: AuditPlugin = {
  name: "axe-core",
  async run(ctx: AuditContext) {
    const results = await new AxeBuilder({ page: ctx.page }).analyze();
    ctx.results.a11y_violations = results.violations;
  },
};
