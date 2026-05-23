import { AuditPlugin, PluginConfigObj, ScannerConfig } from "@scanner/types";
import { PluginExecutionConfig } from "./pipeline.js";

/**
 * pure function to resolve plugins based on configuration and page types.
 */
export function resolvePlugins(
    registry: Map<string, AuditPlugin>,
    config: ScannerConfig,
    types: string[],
    logWarning?: (msg: string) => void
): PluginExecutionConfig[] {
    const executionList: PluginExecutionConfig[] = [];
    const seenPlugins = new Set<string>();

    // Helper to add plugin if valid
    const addPlugin = (pConfig: string | PluginConfigObj) => {
        const name = typeof pConfig === 'string' ? pConfig : pConfig.name;
        const options = typeof pConfig === 'string' ? undefined : pConfig.options;

        if (seenPlugins.has(name)) return;

        const plugin = registry.get(name);
        if (plugin) {
            executionList.push({ plugin, options });
            seenPlugins.add(name);
        } else {
            if (logWarning) {
                logWarning(`Plugin '${name}' required by phase but not loaded/found.`);
            }
        }
    };

    // 1. Always include 'global' phase
    // Fallback to legacy 'plugins' array if global phase not defined
    const globalPhase = config.phases?.global ||
        (config.plugins?.length ? config.plugins : []);

    if (globalPhase) {
        globalPhase.forEach(addPlugin);
    }

    // 2. Add specific phases for matched types
    for (const type of types) {
        if (type === 'global') continue; // Already handled
        const phasePlugins = config.phases?.[type];
        if (phasePlugins) {
            phasePlugins.forEach(addPlugin);
        }
    }

    return executionList;
}
