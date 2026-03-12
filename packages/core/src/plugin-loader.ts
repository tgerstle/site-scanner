import type { AuditPlugin } from "types";
import { logEvent } from "./logger.js";

export async function loadPlugins(pluginNames: string[]): Promise<AuditPlugin[]> {
  const plugins: AuditPlugin[] = [];

  if (!pluginNames || pluginNames.length === 0) {
    return plugins;
  }

  // We load plugins dynamically to avoid circular dependencies and only import what we need.
  // In a real app we might load via configured paths or a known registry.
  for (const name of pluginNames) {
    try {
      if (name === "axe-core" || name === "axe") {
        const { AxePlugin } = await import("plugins/dist/axe.js");
        plugins.push(AxePlugin);
      } else if (name === "lighthouse") {
        const { LighthousePlugin } = await import("plugins/dist/lighthouse.js");
        plugins.push(LighthousePlugin);
      } else if (name === "custom-extractor") {
        const { CustomExtractorPlugin } = await import("plugins/dist/custom-extractor.js");
        plugins.push(CustomExtractorPlugin);
      } else {
        console.warn(`Unknown plugin: ${name}`);
      }
    } catch (err: any) {
      logEvent({
        event: "plugin_load_error",
        severity: "error",
        message: `Failed to load plugin ${name}: ${err.message}`,
      });
    }
  }

  return plugins;
}
