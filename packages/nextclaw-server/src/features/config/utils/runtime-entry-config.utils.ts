import { normalizeModelThinkingCapability } from "@nextclaw/core";

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePositiveInteger(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return null;
  }
  const normalized = Math.trunc(parsed);
  return normalized > 0 ? normalized : null;
}

function normalizeStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const entries = value
    .map((entry) => normalizeOptionalString(entry))
    .filter((entry): entry is string => Boolean(entry));
  return entries.length > 0 ? entries : null;
}

function normalizeUnknownStringRecord(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const entries = Object.entries(value)
    .map(([key, entryValue]) => [key.trim(), normalizeOptionalString(entryValue)] as const)
    .filter(([key, entryValue]) => key.length > 0 && Boolean(entryValue));
  return entries.length > 0 ? Object.fromEntries(entries) as Record<string, string> : null;
}

function normalizeRuntimeModelSelectionMode(value: unknown): string | null {
  if (value === "nextclaw" || value === "optional" || value === "runtime-default") {
    return value;
  }
  return null;
}

export function normalizeRuntimeEntryConfig(
  type: string,
  config: Record<string, unknown>,
): Record<string, unknown> {
  const runtimeDefaultThinking = normalizeModelThinkingCapability(config.runtimeDefaultThinking);
  if (type !== "narp-stdio") {
    const restConfig = Object.fromEntries(
      Object.entries(config).filter(([key]) => key !== "runtimeDefaultThinking"),
    );
    return {
      ...restConfig,
      ...(runtimeDefaultThinking ? { runtimeDefaultThinking } : {}),
    };
  }

  const command = normalizeOptionalString(config.command);
  const args = normalizeStringArray(config.args);
  const cwd = normalizeOptionalString(config.cwd);
  const wireDialect = normalizeOptionalString(config.wireDialect) ?? "acp";
  const processScope = normalizeOptionalString(config.processScope) ?? "per-session";
  const modelSelectionMode = normalizeRuntimeModelSelectionMode(config.modelSelectionMode);
  const supportedModels = normalizeStringArray(config.supportedModels);
  const resetSessionMetadataOnPromptTimeout = normalizeStringArray(
    config.resetSessionMetadataOnPromptTimeout,
  );
  const model = normalizeOptionalString(config.model);
  const recommendedModel = normalizeOptionalString(config.recommendedModel);

  return {
    wireDialect,
    processScope,
    ...(command ? { command } : {}),
    ...(args ? { args } : {}),
    env: normalizeUnknownStringRecord(config.env) ?? {},
    ...(cwd ? { cwd } : {}),
    ...(modelSelectionMode ? { modelSelectionMode } : {}),
    ...(model ? { model } : {}),
    ...(recommendedModel ? { recommendedModel } : {}),
    ...(supportedModels ? { supportedModels } : {}),
    ...(runtimeDefaultThinking ? { runtimeDefaultThinking } : {}),
    ...(resetSessionMetadataOnPromptTimeout
      ? { resetSessionMetadataOnPromptTimeout }
      : {}),
    startupTimeoutMs: normalizePositiveInteger(config.startupTimeoutMs) ?? 8000,
    probeTimeoutMs: normalizePositiveInteger(config.probeTimeoutMs) ?? 3000,
    requestTimeoutMs: normalizePositiveInteger(config.requestTimeoutMs) ?? 120000,
  };
}
