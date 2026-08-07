import { describe, expect, it, vi } from "vitest";
import { ProviderModelDiscoveryService } from "./provider-model-discovery.service.js";

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    statusText: status === 200 ? "OK" : "Unauthorized",
    headers: { "content-type": "application/json" },
  });
}

describe("ProviderModelDiscoveryService", () => {
  it("fetches and deduplicates an OpenAI-compatible model list", async () => {
    const fetcher = vi.fn(async (_input: FetchInput, _init?: FetchInit) =>
      jsonResponse({
        data: [{ id: "gpt-5" }, { id: "gpt-5" }, { id: "gpt-4.1" }],
      }),
    );
    const service = new ProviderModelDiscoveryService(fetcher as typeof fetch);

    const result = await service.discover({
      apiBase: "https://api.example.com/v1",
      apiKey: "secret",
      extraHeaders: { "X-Tenant": "team-a" },
    });

    expect(result).toEqual({
      models: ["gpt-5", "gpt-4.1"],
      source: "provider",
    });
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://api.example.com/v1/models");
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer secret",
    );
    expect(new Headers(init?.headers).get("x-tenant")).toBe("team-a");
  });

  it("only returns text-output chat models from mixed provider catalogs", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        data: [
          { id: "agnes-image-2.1-flash" },
          { id: "agnes-video-v2.0" },
          { id: "text-embedding-3-large" },
          { id: "bge-m3" },
          { id: "vendor-reranker", type: "rerank" },
          {
            id: "gemini-image-output",
            architecture: { output_modalities: ["text", "image"] },
          },
          {
            id: "llama-image-understanding",
            architecture: { output_modalities: ["text"] },
          },
          {
            id: "nemotron-content-safety",
            architecture: { output_modalities: ["text"] },
          },
          {
            id: "llama-guard-4",
            architecture: { output_modalities: ["text"] },
          },
          { id: "claude-sonnet-4-6" },
        ],
      }),
    );
    const service = new ProviderModelDiscoveryService(fetcher as typeof fetch);

    await expect(
      service.discover({ apiBase: "https://api.example.com/v1" }),
    ).resolves.toEqual({
      models: ["llama-image-understanding", "claude-sonnet-4-6"],
      source: "provider",
    });
  });

  it("requires built-in providers to opt into model discovery", async () => {
    const fetcher = vi.fn();
    const service = new ProviderModelDiscoveryService(fetcher as typeof fetch);

    await expect(
      service.discover({
        providerSpec: {
          name: "provider-without-catalog",
          keywords: [],
          envKey: "PROVIDER_API_KEY",
          modelDiscovery: false,
        },
        apiBase: "https://api.example.com/v1",
        apiKey: "secret",
      }),
    ).rejects.toThrow("does not expose a model discovery endpoint");
    await expect(
      service.discover({
        providerSpec: {
          name: "provider-without-audited-catalog",
          keywords: [],
          envKey: "PROVIDER_API_KEY",
        },
        apiBase: "https://api.example.com/v1",
        apiKey: "secret",
      }),
    ).rejects.toThrow("does not expose a model discovery endpoint");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("uses Anthropic model discovery headers and endpoint", async () => {
    const fetcher = vi.fn(async (input: FetchInput, _init?: FetchInit) => {
      const url = String(input);
      return url.includes("after_id=claude-opus-4-8")
        ? jsonResponse({ data: [{ id: "claude-sonnet-4-6" }], has_more: false })
        : jsonResponse({
            data: [{ id: "claude-opus-4-8" }],
            has_more: true,
            last_id: "claude-opus-4-8",
          });
    });
    const service = new ProviderModelDiscoveryService(fetcher as typeof fetch);

    await expect(
      service.discover({
        providerSpec: {
          name: "anthropic",
          keywords: [],
          envKey: "ANTHROPIC_API_KEY",
          modelDiscovery: { kind: "anthropic" },
        },
        apiBase: "https://api.anthropic.com",
        apiKey: "anthropic-secret",
      }),
    ).resolves.toEqual({
      models: ["claude-opus-4-8", "claude-sonnet-4-6"],
      source: "provider",
    });

    const [url, init] = fetcher.mock.calls[0]!;
    const headers = new Headers(init?.headers);
    expect(url).toBe("https://api.anthropic.com/v1/models");
    expect(headers.get("x-api-key")).toBe("anthropic-secret");
    expect(headers.get("anthropic-version")).toBe("2023-06-01");
    expect(headers.get("authorization")).toBeNull();
    expect(fetcher.mock.calls[1]?.[0]).toBe(
      "https://api.anthropic.com/v1/models?after_id=claude-opus-4-8",
    );
  });

  it("filters and caches the OpenCode free catalog", async () => {
    let now = 1_000;
    const fetcher = vi.fn(async (_input: FetchInput, _init?: FetchInit) =>
      jsonResponse({
        opencode: {
          models: {
            "free-no-cost": { id: "free-no-cost" },
            "free-zero": { id: "free-zero", cost: { input: 0, output: 0 } },
            "deprecated-free": {
              id: "deprecated-free",
              status: "deprecated",
              cost: { input: 0 },
            },
            "tiered-paid": {
              id: "tiered-paid",
              cost: { input: 0, context_over_200k: { input: 1 } },
            },
            "free-image": {
              id: "free-image",
              modalities: { input: ["text"], output: ["image"] },
              cost: { input: 0, output: 0 },
            },
            paid: { id: "paid", cost: { input: 1, output: 2 } },
          },
        },
      }),
    );
    const service = new ProviderModelDiscoveryService(
      fetcher as typeof fetch,
      () => now,
      30_000,
      300_000,
    );
    const input = {
      providerSpec: {
        name: "opencode",
        keywords: [],
        envKey: "OPENCODE_API_KEY",
        modelDiscovery: {
          kind: "models-dev" as const,
          url: "https://models.opencode.ai/api.json",
          providerId: "opencode",
          freeOnly: true,
        },
      },
    };

    await expect(service.discover(input)).resolves.toEqual({
      models: ["free-no-cost", "free-zero"],
      source: "catalog",
    });
    now += 1_000;
    await expect(service.discover(input)).resolves.toEqual({
      models: ["free-no-cost", "free-zero"],
      source: "catalog",
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("reports missing bases, HTTP failures, and invalid payloads explicitly", async () => {
    const failing = new ProviderModelDiscoveryService(
      vi.fn(async () =>
        jsonResponse({ error: "bad key" }, 401),
      ) as typeof fetch,
    );
    await expect(
      failing.discover({ apiBase: "https://api.example.com/v1" }),
    ).rejects.toThrow("HTTP 401 Unauthorized");

    const empty = new ProviderModelDiscoveryService(
      vi.fn(async () => jsonResponse({ data: [] })) as typeof fetch,
    );
    await expect(
      empty.discover({ apiBase: "https://api.example.com/v1" }),
    ).rejects.toThrow("no usable models");
    await expect(empty.discover({ apiBase: "" })).rejects.toThrow(
      "API Base URL is required",
    );

    const networkError = Object.assign(new TypeError("fetch failed"), {
      cause: { code: "ECONNREFUSED" },
    });
    const unreachable = new ProviderModelDiscoveryService(
      vi.fn(async () => {
        throw networkError;
      }) as typeof fetch,
    );
    await expect(
      unreachable.discover({ apiBase: "http://127.0.0.1:9/v1" }),
    ).rejects.toThrow(
      "Unable to reach the provider model endpoint (ECONNREFUSED)",
    );
  });
});
