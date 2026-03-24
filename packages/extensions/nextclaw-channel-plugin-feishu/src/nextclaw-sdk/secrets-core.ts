import { z } from "zod";
import type { SecretRef, SecretRefSource } from "./types.js";

export const DEFAULT_SECRET_PROVIDER_ALIAS = "default";
export const ENV_SECRET_REF_ID_RE = /^[A-Z][A-Z0-9_]{0,127}$/;
export const SECRET_PROVIDER_ALIAS_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;
const ENV_SECRET_TEMPLATE_RE = /^\$\{([A-Z][A-Z0-9_]{0,127})\}$/;
const FILE_SECRET_REF_SEGMENT_PATTERN = /^(?:[^~]|~0|~1)*$/;
const EXEC_SECRET_REF_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/;

type SecretDefaults = {
  env?: string;
  file?: string;
  exec?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSecretRef(value: unknown): value is SecretRef {
  return (
    isRecord(value) &&
    (value.source === "env" || value.source === "file" || value.source === "exec") &&
    typeof value.provider === "string" &&
    value.provider.trim().length > 0 &&
    typeof value.id === "string" &&
    value.id.trim().length > 0
  );
}

function coerceSecretRef(value: unknown, defaults?: SecretDefaults): SecretRef | null {
  if (isSecretRef(value)) {
    return value;
  }
  if (typeof value === "string") {
    const match = ENV_SECRET_TEMPLATE_RE.exec(value.trim());
    if (match) {
      return {
        source: "env",
        provider: defaults?.env ?? DEFAULT_SECRET_PROVIDER_ALIAS,
        id: match[1],
      };
    }
  }
  if (!isRecord(value)) {
    return null;
  }
  if (
    (value.source === "env" || value.source === "file" || value.source === "exec") &&
    typeof value.id === "string" &&
    value.id.trim().length > 0 &&
    value.provider === undefined
  ) {
    const source = value.source as SecretRefSource;
    return {
      source,
      provider:
        source === "env"
          ? (defaults?.env ?? DEFAULT_SECRET_PROVIDER_ALIAS)
          : source === "file"
            ? (defaults?.file ?? DEFAULT_SECRET_PROVIDER_ALIAS)
            : (defaults?.exec ?? DEFAULT_SECRET_PROVIDER_ALIAS),
      id: value.id,
    };
  }
  return null;
}

function resolveSecretInputRef(params: {
  value: unknown;
  refValue?: unknown;
  defaults?: SecretDefaults;
}): SecretRef | null {
  return coerceSecretRef(params.refValue, params.defaults) ?? coerceSecretRef(params.value, params.defaults);
}

export function normalizeSecretInputString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function hasConfiguredSecretInput(value: unknown, defaults?: SecretDefaults): boolean {
  return Boolean(normalizeSecretInputString(value) || coerceSecretRef(value, defaults));
}

export function normalizeResolvedSecretInputString(params: {
  value: unknown;
  refValue?: unknown;
  defaults?: SecretDefaults;
  path: string;
}): string | undefined {
  const normalized = normalizeSecretInputString(params.value);
  if (normalized) {
    return normalized;
  }
  const ref = resolveSecretInputRef(params);
  if (ref) {
    throw new Error(
      `${params.path}: unresolved SecretRef "${ref.source}:${ref.provider}:${ref.id}".`,
    );
  }
  return undefined;
}

export function isValidFileSecretRefId(value: string): boolean {
  if (value === "value") {
    return true;
  }
  if (!value.startsWith("/")) {
    return false;
  }
  return value
    .slice(1)
    .split("/")
    .every((segment) => FILE_SECRET_REF_SEGMENT_PATTERN.test(segment));
}

export function isValidExecSecretRefId(value: string): boolean {
  if (!EXEC_SECRET_REF_ID_PATTERN.test(value)) {
    return false;
  }
  return value.split("/").every((segment) => segment !== "." && segment !== "..");
}

export function formatExecSecretRefIdValidationMessage(): string {
  return [
    "Exec secret reference id must match /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/",
    'and must not include "." or ".." path segments',
    '(example: "vault/openai/api-key").',
  ].join(" ");
}

export function buildSecretInputSchema() {
  const providerSchema = z
    .string()
    .regex(
      SECRET_PROVIDER_ALIAS_PATTERN,
      'Secret reference provider must match /^[a-z][a-z0-9_-]{0,63}$/ (example: "default").',
    );

  return z.union([
    z.string(),
    z.discriminatedUnion("source", [
      z.object({
        source: z.literal("env"),
        provider: providerSchema,
        id: z
          .string()
          .regex(
            ENV_SECRET_REF_ID_RE,
            'Env secret reference id must match /^[A-Z][A-Z0-9_]{0,127}$/ (example: "OPENAI_API_KEY").',
          ),
      }),
      z.object({
        source: z.literal("file"),
        provider: providerSchema,
        id: z.string().refine(isValidFileSecretRefId, "Invalid file secret reference id."),
      }),
      z.object({
        source: z.literal("exec"),
        provider: providerSchema,
        id: z.string().refine(isValidExecSecretRefId, formatExecSecretRefIdValidationMessage()),
      }),
    ]),
  ]);
}
