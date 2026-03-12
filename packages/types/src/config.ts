import { z } from "zod";
import * as fs from "node:fs";

export const ScannerConfigSchema = z.object({
    siteUrl: z.string().url(),
    includePaths: z.array(z.string()).optional(),
    excludePaths: z.array(z.string()).optional(),
    plugins: z.array(z.string()).default(["axe", "lighthouse"]),
    outputFormat: z.enum(["json", "sqlite", "both"]).default("sqlite"),
    outputDir: z.string().default("./artifacts"),
    maxDepth: z.number().min(0).default(3),
});

export type ScannerConfig = z.infer<typeof ScannerConfigSchema>;

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

    // Merge order: File JSON <- Overrides (CLI args)
    const merged = {
        ...fileConfig,
        ...overrides,
    };

    // Strip undefined overrides so Zod defaults can apply
    for (const key of Object.keys(merged) as (keyof typeof merged)[]) {
        if (merged[key] === undefined) {
            delete merged[key];
        }
    }

    // Zod will apply defaults to undefined values during parsing
    return ScannerConfigSchema.parse(merged);
}
