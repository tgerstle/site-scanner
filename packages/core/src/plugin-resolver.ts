import { AuditPlugin, PluginConfigObj, ScannerConfig } from "@scanner/types";
import { PluginExecutionConfig } from "./pipeline.js";

/**
 * pure function to resolve plugins based on configuration and page types.
 */
export function resolvePlugins(
    registry: Map<string, AuditPlugin>,
    config: ScannerConfig,
    types: string[],
    logWarning?: (msg: string) => void,
    currentTarget: "html" | "document" = "html"
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
            const targets = plugin.targets ?? ["html"];
            if (!(targets.includes("all") || targets.includes(currentTarget))) {
                return;
            }
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

/**
 * Phase 4: Helper to resolve document-compatible plugins.
 * Called when audit_disposition is "auditable_document".
 */
export function resolveDocumentPlugins(
    registry: Map<string, AuditPlugin>,
    config: ScannerConfig,
    logWarning?: (msg: string) => void,
): PluginExecutionConfig[] {
    // Document audit uses global phase plugins that target "document" or "all"
    const phase = config.phases?.global ?? (config.plugins?.length ? config.plugins : []);
    const executionList: PluginExecutionConfig[] = [];
    const seenPlugins = new Set<string>();

    const addDocumentPlugin = (pConfig: string | PluginConfigObj) => {
        const name = typeof pConfig === 'string' ? pConfig : pConfig.name;
        const options = typeof pConfig === 'string' ? undefined : pConfig.options;

        if (seenPlugins.has(name)) return;

        const plugin = registry.get(name);
        if (plugin) {
            const targets = plugin.targets ?? ["html"];
            // Document plugins must explicitly target "document" or "all"
            if (!(targets.includes("all") || targets.includes("document"))) {
                return;
            }
            executionList.push({ plugin, options });
            seenPlugins.add(name);
        } else {
            if (logWarning) {
                logWarning(`Document plugin '${name}' required but not loaded/found.`);
            }
        }
    };

    if (phase) {
        phase.forEach(addDocumentPlugin);
    }

    return executionList;
}
