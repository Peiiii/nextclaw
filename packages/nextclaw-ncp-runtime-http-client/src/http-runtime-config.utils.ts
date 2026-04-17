export type HttpRuntimeFetchLike = (
  input: URL | string | Request,
  init?: RequestInit,
) => Promise<Response>;

export type HttpRuntimeResolvedConfig = {
  baseUrl?: string;
  basePath?: string;
  endpointId?: string;
  label?: string;
  headers?: Record<string, string>;
  supportedModels?: string[];
  recommendedModel?: string;
  capabilityProbe?: boolean;
  healthcheckUrl?: string;
  healthcheckTimeoutMs?: number;
  fetchImpl?: HttpRuntimeFetchLike;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export class HttpRuntimeConfigResolver {
  constructor(private readonly source: Record<string, unknown>) {}

  resolve = (params: { defaultModel?: string } = {}): HttpRuntimeResolvedConfig => {
    const supportedModels = this.readStringArray(this.source.supportedModels);

    return {
      baseUrl: this.readString(this.source.baseUrl),
      basePath: this.readString(this.source.basePath),
      endpointId: this.readString(this.source.endpointId),
      label: this.readString(this.source.label),
      headers: this.readStringRecord(this.source.headers),
      supportedModels: this.normalizeSupportedModels(supportedModels),
      recommendedModel:
        this.readString(this.source.recommendedModel) ??
        this.readString(this.source.model) ??
        params.defaultModel,
      capabilityProbe: this.readBoolean(this.source.capabilityProbe),
      healthcheckUrl: this.readString(this.source.healthcheckUrl),
      healthcheckTimeoutMs: this.readPositiveInteger(this.source.healthcheckTimeoutMs),
    };
  };

  requireBaseUrl = (): string => {
    const baseUrl = this.readString(this.source.baseUrl);
    if (!baseUrl) {
      throw new Error(
        "[http-runtime] missing baseUrl. Configure the runtime entry baseUrl before starting this HTTP runtime.",
      );
    }
    return baseUrl;
  };

  private readString = (value: unknown): string | undefined => {
    if (typeof value !== "string") {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };

  private readBoolean = (value: unknown): boolean | undefined =>
    typeof value === "boolean" ? value : undefined;

  private readPositiveInteger = (value: unknown): number | undefined => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return undefined;
    }
    const normalized = Math.trunc(value);
    return normalized > 0 ? normalized : undefined;
  };

  private readStringArray = (value: unknown): string[] | undefined => {
    if (!Array.isArray(value)) {
      return undefined;
    }
    const normalized = value
      .map((entry) => this.readString(entry))
      .filter((entry): entry is string => Boolean(entry));
    return normalized.length > 0 ? normalized : undefined;
  };

  private readStringRecord = (value: unknown): Record<string, string> | undefined => {
    if (!isRecord(value)) {
      return undefined;
    }
    const output: Record<string, string> = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
      const normalized = this.readString(entryValue);
      if (!normalized) {
        continue;
      }
      output[entryKey] = normalized;
    }
    return Object.keys(output).length > 0 ? output : undefined;
  };

  private normalizeSupportedModels = (value: string[] | undefined): string[] | undefined => {
    if (!value || value.length === 0) {
      return undefined;
    }
    if (value.some((entry) => entry === "*")) {
      return undefined;
    }
    return value;
  };
}
