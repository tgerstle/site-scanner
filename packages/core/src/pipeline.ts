import type { AuditContext, AuditPlugin } from "types";

export async function runPipeline(ctx: AuditContext, plugins: AuditPlugin[]) {
  for (const plugin of plugins) {
    try {
      await plugin.run(ctx);
    } catch (err: any) {
      ctx.flags.hasErrors = true;
      ctx.log(`Plugin ${plugin.name} failed: ${err.message}`);
    }
  }
}
