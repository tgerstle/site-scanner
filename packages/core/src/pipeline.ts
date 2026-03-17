import type { AuditContext, AuditPlugin } from "types";

export type PluginExecutionConfig = AuditPlugin | { plugin: AuditPlugin; options?: any };

export async function runPipeline(ctx: AuditContext, plugins: PluginExecutionConfig[], pipelineOptions: { timeoutMs?: number } = {}) {
  const timeoutMs = pipelineOptions.timeoutMs ?? 30000;

  for (const item of plugins) {
    let plugin: AuditPlugin;
    let options: any;

    if ('plugin' in item) { // Check if it's the wrapper object
      plugin = item.plugin as AuditPlugin;
      options = item.options;
    } else {
      plugin = item as AuditPlugin;
    }

    try {
      if (typeof plugin.run !== 'function') {
        throw new Error(`Plugin ${plugin.name || 'unknown'} does not have a run method`);
      }

      const timeoutPromise = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error(`Plugin execution timed out after ${timeoutMs}ms`)), timeoutMs)
      );

      await Promise.race([
        plugin.run(ctx, options),
        timeoutPromise
      ]);

    } catch (err: any) {
      ctx.flags.hasErrors = true;
      ctx.log(`Plugin ${plugin.name} failed: ${err.message}`);
    }
  }
}
