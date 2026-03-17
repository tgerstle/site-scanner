import { z } from "zod";
import {
    ScannerConfigSchema as CascadingConfigSchema,
    PluginConfigObjSchema,
    PageDefinitionSchema,
    DiscoveryConfigSchema,
    type PluginConfigObj,
    type PageDefinition,
    type DiscoveryConfig
} from "./cascading/config.js";

// Use the new schema
export const ScannerConfigSchema = CascadingConfigSchema;
export type ScannerConfig = z.infer<typeof ScannerConfigSchema>;

export {
    PluginConfigObjSchema,
    PageDefinitionSchema,
    DiscoveryConfigSchema,
    type PluginConfigObj,
    type PageDefinition,
    type DiscoveryConfig
};
