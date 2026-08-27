import { describe, expect, it, vi } from "vitest";
import { AppMarketplaceQueryService } from "./app-marketplace-query.service.js";

describe("AppMarketplaceQueryService", () => {
  it("reads the catalog without exposing a legacy per-App command field", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      data: {
        items: [{
          appId: "example.notes",
          name: "Notes",
          summary: "Notes",
          latestVersion: "1.0.0",
          tags: [],
          author: "Example",
          install: {
            spec: "example.notes",
            registry: "https://apps.example.test/api/v1/apps/registry/",
            command: "deprecated install command",
          },
        }],
        hasMore: false,
      },
    }), { status: 200 }));
    const service = new AppMarketplaceQueryService({
      apiBaseUrl: "https://apps.example.test/",
      fetchImpl,
    });

    await expect(service.search({ query: "notes", tag: "productivity", limit: 12 }))
      .resolves.toEqual({
        items: [{ install: {
          spec: "example.notes",
          registry: "https://apps.example.test/api/v1/apps/registry/",
        }, appId: "example.notes", name: "Notes", summary: "Notes", latestVersion: "1.0.0", tags: [], author: "Example" }],
        hasMore: false,
      });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://apps.example.test/api/v2/apps/items?q=notes&tag=productivity&limit=12",
      { headers: { accept: "application/json" } },
    );
  });

  it("rejects invalid catalog limits and remote failures", async () => {
    const service = new AppMarketplaceQueryService({ fetchImpl: vi.fn() });
    await expect(service.search({ limit: 0 })).rejects.toThrow("between 1 and 100");
    const unavailable = new AppMarketplaceQueryService({
      fetchImpl: vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })),
    });
    await expect(unavailable.info("example.notes")).rejects.toThrow("503");
  });
});
