import { validateJsonSchemaValue } from "./schema-validator.js";
import type { PluginRecord } from "./types.js";

export function createPluginRecord(params: {
  id: string;
  name?: string;
  description?: string;
  version?: string;
  source: string;
  origin: PluginRecord["origin"];
  workspaceDir?: string;
  enabled: boolean;
  configSchema: boolean;
  configUiHints?: PluginRecord["configUiHints"];
  configJsonSchema?: PluginRecord["configJsonSchema"];
  kind?: PluginRecord["kind"];
}): PluginRecord {
  return {
    id: params.id,
    name: params.name ?? params.id,
    description: params.description,
    version: params.version,
    kind: params.kind,
    source: params.source,
    origin: params.origin,
    workspaceDir: params.workspaceDir,
    enabled: params.enabled,
    status: params.enabled ? "loaded" : "disabled",
    toolNames: [],
    channelIds: [],
    providerIds: [],
    configSchema: params.configSchema,
    configUiHints: params.configUiHints,
    configJsonSchema: params.configJsonSchema,
  };
}

function isPlaceholderConfigSchema(schema: Record<string, unknown> | undefined): boolean {
  if (!schema || typeof schema !== "object") {
    return false;
  }
  const type = schema.type;
  const isObjectType = type === "object" || (Array.isArray(type) && type.includes("object"));
  if (!isObjectType) {
    return false;
  }
  const properties = schema.properties;
  const noProperties =
    !properties ||
    (typeof properties === "object" &&
      !Array.isArray(properties) &&
      Object.keys(properties as Record<string, unknown>).length === 0);
  return noProperties && schema.additionalProperties === false;
}

export function validatePluginConfig(params: {
  schema?: Record<string, unknown>;
  cacheKey?: string;
  value?: unknown;
}): { ok: true; value?: Record<string, unknown> } | { ok: false; errors: string[] } {
  if (!params.schema || isPlaceholderConfigSchema(params.schema)) {
    return { ok: true, value: params.value as Record<string, unknown> | undefined };
  }

  const cacheKey = params.cacheKey ?? JSON.stringify(params.schema);
  const result = validateJsonSchemaValue({
    schema: params.schema,
    cacheKey,
    value: params.value ?? {},
  });

  if (result.ok) {
    return { ok: true, value: params.value as Record<string, unknown> | undefined };
  }

  return { ok: false, errors: result.errors };
}
