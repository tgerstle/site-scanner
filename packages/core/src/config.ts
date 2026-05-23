import { ScannerConfig, ScannerConfigSchema } from "@scanner/types";
import { DEFAULT_CONFIG } from "./default-config.js";
import * as fs from "node:fs";

// Deep merge utility for partial configs
function deepMerge(target: any, source: any): any {
    const isObject = (obj: any) => obj && typeof obj === 'object';

    if (!isObject(target) || !isObject(source)) {
        return source;
    }

    Object.keys(source).forEach(key => {
        if (source[key] === undefined) return;
        const targetValue = target[key];
        const sourceValue = source[key];

        if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
            // For arrays (like phases), we overwrite by default in this version
            // unless specific merge logic is requested.
            target[key] = sourceValue;
        } else if (isObject(targetValue) && isObject(sourceValue)) {
            target[key] = deepMerge(Object.assign({}, targetValue), sourceValue);
        } else {
            target[key] = sourceValue;
        }
    });

    return target;
}

export function loadConfig(
    filePath?: string,
    overrides?: Partial<Record<keyof ScannerConfig, any>>,
): ScannerConfig {
    let fileConfig: Record<string, any> = {};

    if (filePath && fs.existsSync(filePath)) {
        try {
            const fileContent = fs.readFileSync(filePath, "utf-8");
            fileConfig = JSON.parse(fileContent);
        } catch (error) {
            throw new Error(
                `Failed to read or parse config file at ${filePath}: ${(error as Error).message}`,
            );
        }
    }

    let base = {};
    if (fileConfig.useDefaults !== false && overrides?.useDefaults !== false) {
        // deep clone default config to avoid mutation across calls
        base = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    }

    // Merge: Defaults -> File -> CLI Overrides
    // deepMerge mutates the target, so we start with base (which is a fresh clone or empty)
    const mergedFile = deepMerge(base, fileConfig);
    const finalConfig = deepMerge(mergedFile, overrides || {});

    // FIX: If CLI 'plugins' override is present, distinctively replace the global phase
    // to strictly run ONLY the requested plugins, ensuring isolation for debugging.
    if (overrides?.plugins && Array.isArray(overrides.plugins) && overrides.plugins.length > 0) {
        finalConfig.phases = {
            global: overrides.plugins,
            product: [],
            article: [],
            cart: []
        };
    }

    // Cleanup undefined
    for (const key of Object.keys(finalConfig)) {
        if (finalConfig[key] === undefined) {
            delete finalConfig[key];
        }
    }

    return ScannerConfigSchema.parse(finalConfig);
}
