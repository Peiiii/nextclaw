import type {
  ProviderModelDiscoverySpec,
  ProviderSpec,
} from "@core/features/llm-providers/types/provider.types.js";

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_CATALOG_CACHE_TTL_MS = 5 * 60_000;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const TEXT_OUTPUT_MODALITY = "text";
const NON_CHAT_MODEL_KINDS = new Set([
  "audio",
  "embedding",
  "embeddings",
  "image",
  "moderation",
  "rerank",
  "reranker",
  "speech",
  "transcription",
  "video",
]);
const SPECIALIZED_NON_CHAT_MODEL_ID_PATTERN =
  /(?:^|[/:_.-])(audio|dall-?e|diffusion|embed(?:ding|dings)?|guard|imagegen|imagen|moderation|ocr|rerank(?:er)?|safe(?:guard|ty)|sora|speech|transcri(?:be|ption)|tts|veo|video|whisper)(?:$|[/:_.-])/i;
const NON_CHAT_MODEL_FAMILY_PATTERN = /(?:^|[/_.-])(bge|e5|gte)(?:$|[/_.-])/i;
const POSSIBLE_IMAGE_OUTPUT_MODEL_ID_PATTERN =
  /(?:^|[/:_.-])image(?:$|[/:_.-])/i;

type Fetcher = typeof fetch;

type CachedModels = {
  expiresAt: number;
  models: string[];
};

export type ProviderModelDiscoveryInput = {
  providerSpec?: ProviderSpec;
  apiKey?: string | null;
  apiBase?: string | null;
  extraHeaders?: Record<string, string> | null;
  signal?: AbortSignal;
};

export type ProviderModelDiscoveryResult = {
  models: string[];
  source: "provider" | "catalog";
};

export class ProviderModelDiscoveryHttpError extends Error {
  constructor(
    readonly upstreamStatus: number,
    statusText: string,
  ) {
    super(
      `Provider model discovery failed with HTTP ${upstreamStatus} ${statusText}`.trim(),
    );
  }
}

export class ProviderModelDiscoveryService {
  private readonly catalogCache = new Map<string, CachedModels>();

  constructor(
    private readonly fetcher: Fetcher = globalThis.fetch,
    private readonly now: () => number = Date.now,
    private readonly requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    private readonly catalogCacheTtlMs = DEFAULT_CATALOG_CACHE_TTL_MS,
  ) {}

  discover = async (
    input: ProviderModelDiscoveryInput,
  ): Promise<ProviderModelDiscoveryResult> => {
    const strategy = input.providerSpec?.modelDiscovery;
    if (strategy === false || (input.providerSpec && !strategy)) {
      throw new Error(
        "This provider does not expose a model discovery endpoint.",
      );
    }
    if (strategy?.kind === "models-dev") {
      return {
        models: await this.discoverModelsDevModels(strategy, input.signal),
        source: "catalog",
      };
    }

    const apiBase = input.apiBase?.trim();
    if (!apiBase) {
      throw new Error(
        "API Base URL is required to fetch the provider model list.",
      );
    }

    const effectiveStrategy = strategy ?? {
      kind: "openai-compatible" as const,
    };
    const request = this.buildProviderRequest(effectiveStrategy, input);
    return {
      models:
        effectiveStrategy.kind === "anthropic"
          ? await this.discoverAnthropicModels(
              request.url,
              request.headers,
              input.signal,
            )
          : this.readProviderModels(
              await this.fetchJson(request.url, request.headers, input.signal),
            ),
      source: "provider",
    };
  };

  private discoverAnthropicModels = async (
    initialUrl: string,
    headers: Headers,
    signal?: AbortSignal,
  ): Promise<string[]> => {
    const discovered: string[] = [];
    let url = initialUrl;
    for (let page = 0; page < 100; page += 1) {
      const payload = await this.fetchJson(url, headers, signal);
      discovered.push(...this.readProviderModels(payload));
      const pagination = this.readRecord(payload);
      if (pagination.has_more !== true) {
        return this.normalizeModels(discovered);
      }
      const lastId = this.readString(pagination.last_id);
      if (!lastId) {
        throw new Error(
          "Anthropic model discovery reported another page without a last_id cursor.",
        );
      }
      const nextUrl = new URL(initialUrl);
      nextUrl.searchParams.set("after_id", lastId);
      url = nextUrl.toString();
    }
    throw new Error(
      "Anthropic model discovery exceeded the 100-page safety limit.",
    );
  };

  private buildProviderRequest = (
    strategy: Exclude<ProviderModelDiscoverySpec, { kind: "models-dev" }>,
    input: ProviderModelDiscoveryInput,
  ): { url: string; headers: Headers } => {
    const headers = new Headers(input.providerSpec?.defaultHeaders ?? {});
    headers.set("accept", "application/json");
    const apiKey = input.apiKey?.trim();
    if (strategy.kind === "anthropic") {
      if (apiKey) {
        headers.set("x-api-key", apiKey);
      }
      headers.set(
        "anthropic-version",
        strategy.anthropicVersion ?? "2023-06-01",
      );
    } else if (apiKey) {
      headers.set("authorization", `Bearer ${apiKey}`);
    }
    for (const [key, value] of Object.entries(input.extraHeaders ?? {})) {
      if (key.trim() && value.trim()) {
        headers.set(key.trim(), value.trim());
      }
    }
    const path =
      strategy.kind === "anthropic"
        ? (strategy.path ?? "v1/models")
        : (strategy.path ?? "models");
    return {
      url: new URL(
        path.replace(/^\/+/, ""),
        `${input.apiBase!.replace(/\/+$/, "")}/`,
      ).toString(),
      headers,
    };
  };

  private discoverModelsDevModels = async (
    strategy: Extract<ProviderModelDiscoverySpec, { kind: "models-dev" }>,
    signal?: AbortSignal,
  ): Promise<string[]> => {
    const cacheKey = `${strategy.url}|${strategy.providerId}|${strategy.freeOnly === true}`;
    const cached = this.catalogCache.get(cacheKey);
    if (cached && cached.expiresAt > this.now()) {
      return [...cached.models];
    }
    const payload = await this.fetchJson(
      strategy.url,
      new Headers({ accept: "application/json" }),
      signal,
    );
    const provider = this.readRecord(payload)[strategy.providerId];
    const models = this.readRecord(this.readRecord(provider).models);
    const discovered = this.normalizeModels(
      Object.entries(models)
        .filter(
          ([id, value]) =>
            this.isChatModel(value, id) &&
            (!strategy.freeOnly || this.isFreeCatalogModel(value)),
        )
        .map(([id, value]) => this.readString(this.readRecord(value).id) ?? id),
    );
    this.assertModelsFound(discovered);
    this.catalogCache.set(cacheKey, {
      expiresAt: this.now() + this.catalogCacheTtlMs,
      models: discovered,
    });
    return [...discovered];
  };

  private readProviderModels = (payload: unknown): string[] => {
    const record = this.readRecord(payload);
    const entries = Array.isArray(record.data)
      ? record.data
      : Array.isArray(record.models)
        ? record.models
        : [];
    const models = this.normalizeModels(
      entries.flatMap((entry) => {
        if (typeof entry === "string") {
          return this.isChatModel(entry, entry) ? [entry] : [];
        }
        const model = this.readRecord(entry);
        const id =
          this.readString(model.id) ?? this.readString(model.name) ?? "";
        return this.isChatModel(model, id) ? [id] : [];
      }),
    );
    this.assertModelsFound(models);
    return models;
  };

  private normalizeModels = (models: string[]): string[] => {
    const normalized = new Set<string>();
    for (const model of models) {
      const id = model.trim();
      if (id) {
        normalized.add(id);
      }
    }
    return [...normalized];
  };

  private isFreeCatalogModel = (value: unknown): boolean => {
    const model = this.readRecord(value);
    if (this.readString(model.status) === "deprecated") {
      return false;
    }
    const cost = this.readRecord(model.cost);
    const contextualCost = this.readRecord(cost.context_over_200k);
    return (
      this.readNumber(cost.input) === 0 &&
      (!Object.keys(contextualCost).length ||
        this.readNumber(contextualCost.input) === 0)
    );
  };

  private isChatModel = (value: unknown, fallbackId: string): boolean => {
    const model = this.readRecord(value);
    const id =
      this.readString(model.id) ?? this.readString(model.name) ?? fallbackId;
    const kind = [model.type, model.kind, model.category, model.model_type]
      .map((candidate) => this.readString(candidate)?.toLowerCase())
      .find(Boolean);
    if (
      (kind && NON_CHAT_MODEL_KINDS.has(kind)) ||
      SPECIALIZED_NON_CHAT_MODEL_ID_PATTERN.test(id) ||
      NON_CHAT_MODEL_FAMILY_PATTERN.test(id)
    ) {
      return false;
    }
    const outputModalities = [
      ...this.readStringArray(this.readRecord(model.modalities).output),
      ...this.readStringArray(
        this.readRecord(model.architecture).output_modalities,
      ),
      ...this.readStringArray(model.output_modalities),
    ].map((modality) => modality.toLowerCase());
    if (outputModalities.length > 0) {
      return (
        outputModalities.includes(TEXT_OUTPUT_MODALITY) &&
        outputModalities.every((modality) => modality === TEXT_OUTPUT_MODALITY)
      );
    }
    return !POSSIBLE_IMAGE_OUTPUT_MODEL_ID_PATTERN.test(id);
  };

  private assertModelsFound = (models: string[]): void => {
    if (models.length === 0) {
      throw new Error("The provider returned no usable models.");
    }
  };

  private readRecord = (value: unknown): Record<string, unknown> => {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  };

  private readString = (value: unknown): string | null => {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  };

  private readStringArray = (value: unknown): string[] => {
    return Array.isArray(value)
      ? value.flatMap((entry) => this.readString(entry) ?? [])
      : [];
  };

  private readNumber = (value: unknown): number => {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  };

  private fetchJson = async (
    url: string,
    headers: Headers,
    signal?: AbortSignal,
  ): Promise<unknown> => {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.requestTimeoutMs);
    const abort = () => controller.abort(signal?.reason);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) {
      abort();
    }
    try {
      const response = await this.fetcher(url, {
        method: "GET",
        headers,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new ProviderModelDiscoveryHttpError(
          response.status,
          response.statusText,
        );
      }
      const body = await response.text();
      if (new TextEncoder().encode(body).byteLength > MAX_RESPONSE_BYTES) {
        throw new Error(
          "Provider model discovery response exceeded the 10 MB limit.",
        );
      }
      try {
        return JSON.parse(body) as unknown;
      } catch {
        throw new Error("Provider model discovery returned invalid JSON.");
      }
    } catch (error) {
      if (timedOut) {
        throw new Error(
          `Provider model discovery timed out after ${this.requestTimeoutMs}ms.`,
        );
      }
      if (signal?.aborted) {
        throw new Error("Provider model discovery was cancelled.");
      }
      if (error instanceof TypeError) {
        const cause = this.readRecord(
          (error as TypeError & { cause?: unknown }).cause,
        );
        const code = this.readString(cause.code);
        throw new Error(
          `Unable to reach the provider model endpoint${code ? ` (${code})` : ""}. Check the API Base URL and network, then retry.`,
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  };
}
