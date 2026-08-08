import type { Config, ProviderConfig } from "@nextclaw/core";
import type { LlmProviderManager } from "./llm-provider.manager.js";

export const PROVIDER_MODEL_CATALOG_REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000;
const PROVIDER_MODEL_CATALOG_PROVIDER_TIMEOUT_MS = 45_000;

export type ProviderModelCatalogEntry = {
  providerId: string;
  models: string[];
  source: "provider" | "catalog" | null;
  fetchedAt: string | null;
  lastError: {
    message: string;
    occurredAt: string;
  } | null;
};

export type ProviderModelCatalogSnapshot = {
  refreshIntervalMs: number;
  refreshing: boolean;
  lastRefreshStartedAt: string | null;
  lastRefreshCompletedAt: string | null;
  providers: Record<string, ProviderModelCatalogEntry>;
};

type ProviderModelCatalogManagerOptions = {
  refreshIntervalMs?: number;
  providerTimeoutMs?: number;
  now?: () => Date;
};

export class ProviderModelCatalogManager {
  private config: Config | null = null;
  private readonly entries = new Map<string, ProviderModelCatalogEntry>();
  private readonly providerTimeoutMs: number;
  private readonly refreshIntervalMs: number;
  private readonly now: () => Date;
  private refreshTask: Promise<void> | null = null;
  private refreshPending = false;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;
  private lastRefreshStartedAt: string | null = null;
  private lastRefreshCompletedAt: string | null = null;

  constructor(
    private readonly providerManager: Pick<LlmProviderManager, "discoverModels" | "supportsModelDiscovery">,
    options: ProviderModelCatalogManagerOptions = {},
  ) {
    this.refreshIntervalMs = options.refreshIntervalMs ?? PROVIDER_MODEL_CATALOG_REFRESH_INTERVAL_MS;
    this.providerTimeoutMs = options.providerTimeoutMs ?? PROVIDER_MODEL_CATALOG_PROVIDER_TIMEOUT_MS;
    this.now = options.now ?? (() => new Date());
  }

  load = (config: Config): void => {
    this.config = config;
    const enabledProviderIds = new Set(
      Object.entries(config.providers)
        .filter(([providerId, provider]) => provider.enabled !== false && this.providerManager.supportsModelDiscovery(
          provider.providerType?.trim() || providerId,
        ))
        .map(([providerId]) => providerId),
    );
    for (const providerId of this.entries.keys()) {
      if (!enabledProviderIds.has(providerId)) {
        this.entries.delete(providerId);
      }
    }
    if (this.started) {
      void this.refresh();
    }
  };

  start = (): void => {
    if (this.started) {
      return;
    }
    this.started = true;
    void this.refresh();
    this.refreshTimer = setInterval(() => {
      void this.refresh();
    }, this.refreshIntervalMs);
    this.refreshTimer.unref?.();
  };

  dispose = (): void => {
    this.started = false;
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  };

  refresh = async (): Promise<void> => {
    if (this.refreshTask) {
      this.refreshPending = true;
      return await this.refreshTask;
    }
    this.refreshTask = this.refreshConfiguredProviders();
    try {
      await this.refreshTask;
    } finally {
      this.refreshTask = null;
      if (this.refreshPending) {
        this.refreshPending = false;
        void this.refresh();
      }
    }
  };

  getSnapshot = (): ProviderModelCatalogSnapshot => ({
    refreshIntervalMs: this.refreshIntervalMs,
    refreshing: this.refreshTask !== null,
    lastRefreshStartedAt: this.lastRefreshStartedAt,
    lastRefreshCompletedAt: this.lastRefreshCompletedAt,
    providers: Object.fromEntries(
      [...this.entries.entries()].map(([providerId, entry]) => [providerId, {
        ...entry,
        models: [...entry.models],
        lastError: entry.lastError ? { ...entry.lastError } : null,
      }]),
    ),
  });

  private refreshConfiguredProviders = async (): Promise<void> => {
    const config = this.config;
    this.lastRefreshStartedAt = this.now().toISOString();
    if (!config) {
      this.lastRefreshCompletedAt = this.now().toISOString();
      return;
    }
    const providers = Object.entries(config.providers)
      .filter(([providerId, provider]) => provider.enabled !== false && this.providerManager.supportsModelDiscovery(
        provider.providerType?.trim() || providerId,
      ));
    await Promise.all(providers.map(async ([providerId, provider]) => {
      await this.refreshProvider(providerId, provider);
    }));
    this.lastRefreshCompletedAt = this.now().toISOString();
  };

  private refreshProvider = async (
    providerId: string,
    provider: ProviderConfig,
  ): Promise<void> => {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | null = null;
    try {
      const result = await Promise.race([
        this.providerManager.discoverModels({
          providerName: provider.providerType?.trim() || providerId,
          apiKey: provider.apiKey,
          apiBase: provider.apiBase,
          extraHeaders: provider.extraHeaders,
          signal: controller.signal,
        }),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => {
            controller.abort();
            reject(new Error(`Provider model catalog refresh timed out after ${this.providerTimeoutMs}ms.`));
          }, this.providerTimeoutMs);
        }),
      ]);
      this.entries.set(providerId, {
        providerId,
        models: [...result.models],
        source: result.source,
        fetchedAt: this.now().toISOString(),
        lastError: null,
      });
    } catch (error) {
      const previous = this.entries.get(providerId);
      this.entries.set(providerId, {
        providerId,
        models: [...(previous?.models ?? [])],
        source: previous?.source ?? null,
        fetchedAt: previous?.fetchedAt ?? null,
        lastError: {
          message: error instanceof Error ? error.message : String(error),
          occurredAt: this.now().toISOString(),
        },
      });
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  };
}
