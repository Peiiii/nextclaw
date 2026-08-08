import { ConfigSchema } from "@nextclaw/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PROVIDER_MODEL_CATALOG_REFRESH_INTERVAL_MS,
  ProviderModelCatalogManager,
} from "@kernel/managers/provider-model-catalog.manager.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("ProviderModelCatalogManager", () => {
  it("refreshes enabled providers without changing user configuration", async () => {
    const config = ConfigSchema.parse({
      providers: {
        openai: {
          providerType: "openai",
          apiKey: "secret",
          apiBase: "https://api.openai.com/v1",
          models: ["gpt-existing"],
        },
        disabled: {
          enabled: false,
          apiBase: "https://disabled.example.com/v1",
        },
      },
    });
    const originalConfig = structuredClone(config);
    const discoverModels = vi.fn(async () => ({
      models: ["gpt-existing", "gpt-new"],
      source: "provider" as const,
    }));
    const manager = new ProviderModelCatalogManager({ discoverModels, supportsModelDiscovery: () => true });
    manager.load(config);

    await manager.refresh();

    expect(discoverModels).toHaveBeenCalledTimes(1);
    expect(discoverModels).toHaveBeenCalledWith({
      providerName: "openai",
      apiKey: "secret",
      apiBase: "https://api.openai.com/v1",
      extraHeaders: null,
    });
    expect(manager.getSnapshot()).toMatchObject({
      refreshIntervalMs: PROVIDER_MODEL_CATALOG_REFRESH_INTERVAL_MS,
      refreshing: false,
      lastRefreshStartedAt: expect.any(String),
      lastRefreshCompletedAt: expect.any(String),
      providers: {
        openai: {
          providerId: "openai",
          models: ["gpt-existing", "gpt-new"],
          source: "provider",
          fetchedAt: expect.any(String),
          lastError: null,
        },
      },
    });
    expect(manager.getSnapshot().providers.disabled).toBeUndefined();
    expect(config).toEqual(originalConfig);
  });

  it("starts immediately, refreshes on the configured interval, and stops on dispose", async () => {
    vi.useFakeTimers();
    const discoverModels = vi.fn(async () => ({
      models: ["big-pickle"],
      source: "catalog" as const,
    }));
    const manager = new ProviderModelCatalogManager(
      { discoverModels, supportsModelDiscovery: () => true },
      { refreshIntervalMs: 1_000 },
    );
    manager.load(ConfigSchema.parse({
      providers: {
        opencode: { providerType: "opencode" },
      },
    }));

    manager.start();
    await vi.waitFor(() => expect(discoverModels).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.waitFor(() => expect(discoverModels).toHaveBeenCalledTimes(2));

    manager.dispose();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(discoverModels).toHaveBeenCalledTimes(2);
  });

  it("isolates provider failures and keeps the most recent successful catalog", async () => {
    const discoverModels = vi.fn()
      .mockResolvedValueOnce({ models: ["gpt-5"], source: "provider" as const })
      .mockRejectedValueOnce(new Error("upstream unavailable"));
    const manager = new ProviderModelCatalogManager({ discoverModels, supportsModelDiscovery: () => true });
    manager.load(ConfigSchema.parse({
      providers: {
        openai: {
          providerType: "openai",
          apiKey: "secret",
          apiBase: "https://api.openai.com/v1",
        },
      },
    }));

    await manager.refresh();
    const firstFetchedAt = manager.getSnapshot().providers.openai?.fetchedAt;
    await manager.refresh();

    expect(manager.getSnapshot().providers.openai).toEqual({
      providerId: "openai",
      models: ["gpt-5"],
      source: "provider",
      fetchedAt: firstFetchedAt,
      lastError: {
        message: "upstream unavailable",
        occurredAt: expect.any(String),
      },
    });
  });

  it("coalesces overlapping refresh requests into one follow-up pass", async () => {
    let releaseFirst: (() => void) | undefined;
    const firstCall = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const discoverModels = vi.fn()
      .mockImplementationOnce(async () => {
        await firstCall;
        return { models: ["first"], source: "provider" as const };
      })
      .mockResolvedValue({ models: ["second"], source: "provider" as const });
    const manager = new ProviderModelCatalogManager({ discoverModels, supportsModelDiscovery: () => true });
    manager.load(ConfigSchema.parse({
      providers: {
        openai: {
          providerType: "openai",
          apiKey: "secret",
          apiBase: "https://api.openai.com/v1",
        },
      },
    }));

    const first = manager.refresh();
    const overlapping = manager.refresh();
    releaseFirst?.();
    await Promise.all([first, overlapping]);
    await vi.waitFor(() => expect(discoverModels).toHaveBeenCalledTimes(2));

    expect(manager.getSnapshot().providers.openai?.models).toEqual(["second"]);
  });

  it("skips providers that do not expose model discovery", async () => {
    const discoverModels = vi.fn(async () => ({
      models: ["gpt-5"],
      source: "provider" as const,
    }));
    const manager = new ProviderModelCatalogManager({
      discoverModels,
      supportsModelDiscovery: (providerName) => providerName !== "dashscope",
    });
    manager.load(ConfigSchema.parse({
      providers: {
        dashscope: { providerType: "dashscope", apiKey: "secret" },
        openai: { providerType: "openai", apiKey: "secret" },
      },
    }));

    await manager.refresh();

    expect(discoverModels).toHaveBeenCalledOnce();
    expect(discoverModels).toHaveBeenCalledWith(expect.objectContaining({ providerName: "openai" }));
    expect(manager.getSnapshot().providers.dashscope).toBeUndefined();
  });
});
