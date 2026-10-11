import { zodToJsonSchema } from "zod-to-json-schema";
import { getPackageVersion, getWorkspacePath } from "@core/shared/lib/core-utils/index.js";
import { applySensitiveHints, buildBaseHints, mapSensitivePaths } from "@core/features/config/utils/config-schema-hints.utils.js";
import { buildConfigActions } from "@core/features/config/utils/config-actions.utils.js";
import { ConfigSchema, type Config, type ConfigSchemaResponse, type ConfigSchemaJson } from "./config-value-schema.config.js";
export * from "./config-value-schema.config.js";
export { getApiBase, getApiKey, getProvider, getProviderName, matchProvider } from "../utils/config-provider-match.utils.js";

export function getWorkspacePathFromConfig(config: Config): string {
  return getWorkspacePath(config.agents.defaults.workspace);
}

export function buildConfigSchema(options?: { version?: string }): ConfigSchemaResponse {
  const baseSchema = zodToJsonSchema(ConfigSchema, {
    name: "NextClawConfig",
    target: "jsonSchema7"
  }) as ConfigSchemaJson;
  if (baseSchema && typeof baseSchema === "object") {
    baseSchema.title = "NextClawConfig";
  }

  const baseHints = mapSensitivePaths(ConfigSchema, "", buildBaseHints());
  const mergedHints = applySensitiveHints(baseHints);

  return {
    schema: baseSchema,
    uiHints: mergedHints,
    actions: buildConfigActions(),
    version: options?.version ?? getPackageVersion(),
    generatedAt: new Date().toISOString()
  };
}
