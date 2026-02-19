import { z } from "zod";
import { FIELD_HELP } from "./schema.help.js";
import { FIELD_LABELS } from "./schema.labels.js";

export type ConfigUiHint = {
  label?: string;
  help?: string;
  group?: string;
  order?: number;
  advanced?: boolean;
  sensitive?: boolean;
  placeholder?: string;
  readOnly?: boolean;
};

export type ConfigUiHints = Record<string, ConfigUiHint>;

const GROUP_LABELS: Record<string, string> = {
  agents: "Agents",
  providers: "Providers",
  channels: "Channels",
  tools: "Tools",
  plugins: "Plugins",
  gateway: "Gateway",
  ui: "UI"
};

const GROUP_ORDER: Record<string, number> = {
  agents: 20,
  providers: 30,
  channels: 40,
  tools: 50,
  plugins: 55,
  gateway: 60,
  ui: 70
};

const FIELD_PLACEHOLDERS: Record<string, string> = {
  "gateway.host": "0.0.0.0",
  "gateway.port": "18790",
  "ui.host": "0.0.0.0",
  "ui.port": "18791",
  "providers.*.apiBase": "https://api.example.com",
  "providers.minimax.apiBase": "CN: https://api.minimaxi.com/v1; Global: https://api.minimax.io/v1"
};

const READ_ONLY_FIELDS = new Set<string>(["ui.host"]);

const SENSITIVE_KEY_WHITELIST_SUFFIXES = [
  "maxtokens",
  "maxoutputtokens",
  "maxinputtokens",
  "maxcompletiontokens",
  "contexttokens",
  "totaltokens",
  "tokencount",
  "tokenlimit",
  "tokenbudget"
] as const;

const NORMALIZED_SENSITIVE_KEY_WHITELIST_SUFFIXES = SENSITIVE_KEY_WHITELIST_SUFFIXES.map((suffix) =>
  suffix.toLowerCase()
);

const SENSITIVE_PATTERNS = [/token$/i, /password/i, /secret/i, /api.?key/i];

function isWhitelistedSensitivePath(path: string): boolean {
  const lowerPath = path.toLowerCase();
  return NORMALIZED_SENSITIVE_KEY_WHITELIST_SUFFIXES.some((suffix) => lowerPath.endsWith(suffix));
}

function matchesSensitivePattern(path: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(path));
}

export function isSensitiveConfigPath(path: string): boolean {
  return !isWhitelistedSensitivePath(path) && matchesSensitivePattern(path);
}

export function buildBaseHints(): ConfigUiHints {
  const hints: ConfigUiHints = {};
  for (const [group, label] of Object.entries(GROUP_LABELS)) {
    hints[group] = {
      label,
      group: label,
      order: GROUP_ORDER[group]
    };
  }
  for (const [path, label] of Object.entries(FIELD_LABELS)) {
    const current = hints[path];
    hints[path] = current ? { ...current, label } : { label };
  }
  for (const [path, help] of Object.entries(FIELD_HELP)) {
    const current = hints[path];
    hints[path] = current ? { ...current, help } : { help };
  }
  for (const [path, placeholder] of Object.entries(FIELD_PLACEHOLDERS)) {
    const current = hints[path];
    hints[path] = current ? { ...current, placeholder } : { placeholder };
  }
  for (const path of READ_ONLY_FIELDS) {
    const current = hints[path];
    hints[path] = current ? { ...current, readOnly: true } : { readOnly: true };
  }
  return hints;
}

export function applySensitiveHints(hints: ConfigUiHints): ConfigUiHints {
  const next = { ...hints };
  for (const key of Object.keys(next)) {
    if (next[key]?.sensitive !== undefined) {
      continue;
    }
    if (isSensitiveConfigPath(key)) {
      next[key] = { ...next[key], sensitive: true };
    }
  }
  return next;
}

interface ZodDummy {
  unwrap: () => z.ZodType;
}

function isUnwrappable(object: unknown): object is ZodDummy {
  return (
    !!object &&
    typeof object === "object" &&
    "unwrap" in object &&
    typeof (object as Record<string, unknown>).unwrap === "function" &&
    !(object instanceof z.ZodArray)
  );
}

export function mapSensitivePaths(
  schema: z.ZodType,
  path: string,
  hints: ConfigUiHints
): ConfigUiHints {
  let next = { ...hints };
  let currentSchema = schema;

  while (isUnwrappable(currentSchema)) {
    currentSchema = currentSchema.unwrap();
  }

  if (path && isSensitiveConfigPath(path) && !next[path]?.sensitive) {
    next[path] = { ...next[path], sensitive: true };
  }

  if (currentSchema instanceof z.ZodObject) {
    const shape = currentSchema.shape;
    for (const key in shape) {
      const nextPath = path ? `${path}.${key}` : key;
      next = mapSensitivePaths(shape[key], nextPath, next);
    }
  } else if (currentSchema instanceof z.ZodArray) {
    const nextPath = path ? `${path}[]` : "[]";
    next = mapSensitivePaths(currentSchema.element as z.ZodType, nextPath, next);
  } else if (currentSchema instanceof z.ZodRecord) {
    const nextPath = path ? `${path}.*` : "*";
    next = mapSensitivePaths(currentSchema._def.valueType as z.ZodType, nextPath, next);
  } else if (currentSchema instanceof z.ZodUnion || currentSchema instanceof z.ZodDiscriminatedUnion) {
    for (const option of currentSchema.options) {
      next = mapSensitivePaths(option as z.ZodType, path, next);
    }
  }

  return next;
}
