import type {
  HermesHttpAdapterConfig,
  HermesHttpAdapterFetchLike,
  HermesHttpAdapterResolvedConfig,
} from "./hermes-http-adapter.types.js";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 8765;
const DEFAULT_BASE_PATH = "/ncp/agent";
const DEFAULT_HERMES_BASE_URL = "http://127.0.0.1:8642";
const DEFAULT_MODEL = "hermes-agent";
const DEFAULT_STREAM_WAIT_TIMEOUT_MS = 15000;
const DEFAULT_HEALTHCHECK_TIMEOUT_MS = 3000;

export type HermesHttpAdapterConfigInput = Partial<
  Omit<HermesHttpAdapterConfig, "fetchImpl">
> & {
  fetchImpl?: HermesHttpAdapterFetchLike;
};

export class HermesHttpAdapterConfigResolver {
  constructor(private readonly source: HermesHttpAdapterConfigInput = {}) {}

  resolve = (): HermesHttpAdapterResolvedConfig => {
    const basePath = normalizeBasePath(
      this.source.basePath ??
        process.env.NEXTCLAW_HERMES_ADAPTER_BASE_PATH ??
        DEFAULT_BASE_PATH,
    );
    const hermesBaseUrl = readString(
      this.source.hermesBaseUrl ?? process.env.HERMES_API_BASE_URL,
    ) ?? DEFAULT_HERMES_BASE_URL;
    const resolved: HermesHttpAdapterConfig = {
      host:
        readString(this.source.host ?? process.env.NEXTCLAW_HERMES_ADAPTER_HOST) ??
        DEFAULT_HOST,
      port:
        readPositiveInteger(this.source.port) ??
        readPositiveInteger(process.env.NEXTCLAW_HERMES_ADAPTER_PORT) ??
        DEFAULT_PORT,
      basePath,
      hermesBaseUrl,
      hermesApiKey: readString(this.source.hermesApiKey ?? process.env.HERMES_API_KEY),
      model:
        readString(this.source.model ?? process.env.HERMES_MODEL) ?? DEFAULT_MODEL,
      systemPrompt: readString(
        this.source.systemPrompt ?? process.env.HERMES_SYSTEM_PROMPT,
      ),
      streamWaitTimeoutMs:
        readPositiveInteger(this.source.streamWaitTimeoutMs) ??
        readPositiveInteger(process.env.NEXTCLAW_HERMES_ADAPTER_STREAM_WAIT_TIMEOUT_MS) ??
        DEFAULT_STREAM_WAIT_TIMEOUT_MS,
      healthcheckTimeoutMs:
        readPositiveInteger(this.source.healthcheckTimeoutMs) ??
        readPositiveInteger(process.env.NEXTCLAW_HERMES_ADAPTER_HEALTHCHECK_TIMEOUT_MS) ??
        DEFAULT_HEALTHCHECK_TIMEOUT_MS,
      ...(this.source.fetchImpl ? { fetchImpl: this.source.fetchImpl } : {}),
    };

    return {
      ...resolved,
      chatCompletionsUrl: resolveHermesApiUrl(hermesBaseUrl, "chat/completions"),
      healthcheckUrl: resolveHermesHealthcheckUrl(hermesBaseUrl),
    };
  };
}

export function normalizeBasePath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_BASE_PATH;
  }
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.endsWith("/")
    ? withLeadingSlash.slice(0, -1)
    : withLeadingSlash;
}

export function resolveHermesApiUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.trim().replace(/\/+$/, "");
  const normalizedPath = path.replace(/^\/+/, "");
  const hasVersionPath = /\/v1$/u.test(normalizedBase);
  const prefix = hasVersionPath ? "" : "/v1";
  return `${normalizedBase}${prefix}/${normalizedPath}`;
}

export function resolveHermesHealthcheckUrl(baseUrl: string): string {
  const normalizedBase = baseUrl.trim().replace(/\/+$/, "");
  const rootBase = normalizedBase.endsWith("/v1")
    ? normalizedBase.slice(0, -"/v1".length)
    : normalizedBase;
  return `${rootBase}/health`;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readPositiveInteger(value: unknown): number | undefined {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  const normalized = Math.trunc(parsed);
  return normalized > 0 ? normalized : undefined;
}
