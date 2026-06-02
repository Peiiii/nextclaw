import type { NcpProviderRuntimeRoute } from "@nextclaw/ncp";
import type {
  OpencodeProviderApiMode,
  OpencodeResolvedRoute,
} from "@opencode-narp/types/opencode-narp-runtime.types.js";

const NARP_API_MODE_HEADER = "x-nextclaw-narp-api-mode";
const DEFAULT_PROVIDER_ID = "nextclaw";

export function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function readRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

export function stripProviderPrefix(value: string | undefined): string | undefined {
  const normalized = readString(value);
  if (!normalized) {
    return undefined;
  }
  const slashIndex = normalized.indexOf("/");
  if (slashIndex <= 0) {
    return normalized;
  }
  return readString(normalized.slice(slashIndex + 1));
}

export function readModelProvider(value: string | undefined): string | undefined {
  const normalized = readString(value);
  if (!normalized) {
    return undefined;
  }
  const slashIndex = normalized.indexOf("/");
  if (slashIndex <= 0) {
    return undefined;
  }
  return readString(normalized.slice(0, slashIndex));
}

export function resolveOpencodeRoute(params: {
  modelId?: string;
  providerRoute?: NcpProviderRuntimeRoute;
  sessionMetadata?: Record<string, unknown>;
}): OpencodeResolvedRoute {
  const { modelId, providerRoute, sessionMetadata } = params;
  const selectedModel =
    readString(sessionMetadata?.preferred_model) ??
    readString(sessionMetadata?.preferredModel) ??
    readString(sessionMetadata?.model) ??
    readString(modelId) ??
    readString(providerRoute?.model);
  const modelLocalId =
    stripProviderPrefix(readString(providerRoute?.model)) ??
    stripProviderPrefix(selectedModel);
  if (!modelLocalId) {
    throw new Error("[opencode-narp] missing selected model for OpenCode runtime");
  }

  const providerId = normalizeProviderId(
    readModelProvider(selectedModel) ??
    readModelProvider(modelId) ??
    inferProviderId(providerRoute?.apiBase) ??
    DEFAULT_PROVIDER_ID,
  );
  const apiMode = readApiMode(providerRoute?.headers);
  const modelRoute = `${providerId}/${modelLocalId}`;
  const apiKey = readString(providerRoute?.apiKey) ?? readString(process.env.NEXTCLAW_API_KEY) ?? "";
  const apiBase =
    readString(providerRoute?.apiBase) ??
    readString(process.env.NEXTCLAW_API_BASE);
  const headers = stripInternalRouteHeaders(providerRoute?.headers);

  return {
    apiBase,
    apiKey,
    apiMode,
    headers,
    modelId: modelLocalId,
    modelRoute,
    providerId,
    providerRoute: {
      model: modelRoute,
      apiKey,
      apiBase,
      headers: {
        ...(headers ?? {}),
        [NARP_API_MODE_HEADER]: apiMode,
      },
    },
  };
}

export function resolveOpencodeProviderNpm(apiMode: OpencodeProviderApiMode): string {
  if (apiMode === "anthropic_messages") {
    return "@ai-sdk/anthropic";
  }
  if (apiMode === "codex_responses") {
    return "@ai-sdk/openai";
  }
  return "@ai-sdk/openai-compatible";
}

function readApiMode(headers: Record<string, string> | undefined): OpencodeProviderApiMode {
  const raw = Object.entries(headers ?? {}).find(
    ([key]) => key.toLowerCase() === NARP_API_MODE_HEADER,
  )?.[1];
  const normalized = readString(raw)?.toLowerCase();
  if (
    normalized === "anthropic_messages" ||
    normalized === "chat_completions" ||
    normalized === "codex_responses"
  ) {
    return normalized;
  }
  return "chat_completions";
}

function stripInternalRouteHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> | undefined {
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (key.toLowerCase() === NARP_API_MODE_HEADER) {
      continue;
    }
    output[key] = value;
  }
  return Object.keys(output).length > 0 ? output : undefined;
}

function normalizeProviderId(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || DEFAULT_PROVIDER_ID;
}

function inferProviderId(apiBase: string | null | undefined): string | undefined {
  const normalized = readString(apiBase);
  if (!normalized) {
    return undefined;
  }
  try {
    const host = new URL(normalized).hostname.toLowerCase();
    if (host.includes("deepseek")) {
      return "deepseek";
    }
    if (host.includes("minimaxi")) {
      return "minimax";
    }
    if (host.includes("openrouter")) {
      return "openrouter";
    }
  } catch {
    return undefined;
  }
  return undefined;
}
