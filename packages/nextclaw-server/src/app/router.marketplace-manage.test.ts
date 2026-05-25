import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { createUiRouter } from "./router.js";
import { createRouterTestKernel } from "@nextclaw-server/app/tests/router-test-kernel.js";
import { EventBus } from "@nextclaw/shared";

const tempDirs: string[] = [];

function createTempConfigPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-ui-router-test-"));
  tempDirs.push(dir);
  return join(dir, "config.json");
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  vi.restoreAllMocks();
});

describe("marketplace manage plugin id resolution", () => {
  it("maps canonical plugin spec to installed plugin id when disabling", async () => {
    const configPath = createTempConfigPath();
    saveConfig(
      ConfigSchema.parse({
        plugins: {
          entries: {
            "plugin-discord": {
              enabled: true
            }
          },
          installs: {
            "plugin-discord": {
              source: "npm",
              spec: "@community/discord-channel"
            }
          }
        }
      }),
      configPath
    );

    const disablePlugin = vi.fn(async () => ({
      message: "Disabled plugin \"plugin-discord\"."
    }));

    const app = createUiRouter({
      kernel: createRouterTestKernel(),
      configPath,
      appEventBus: new EventBus(),
      marketplace: {
        installer: {
          disablePlugin
        }
      }
    });

    const response = await app.request("http://localhost/api/marketplace/plugins/manage", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        type: "plugin",
        action: "disable",
        id: "@community/discord-channel",
        spec: "@community/discord-channel"
      })
    });

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      ok: boolean;
      data: {
        id: string;
      };
    };

    expect(payload.ok).toBe(true);
    expect(payload.data.id).toBe("plugin-discord");
    expect(disablePlugin).toHaveBeenCalledTimes(1);
    expect(disablePlugin).toHaveBeenCalledWith("plugin-discord");
  });

  it("rejects body type mismatch for typed marketplace route", async () => {
    const configPath = createTempConfigPath();
    saveConfig(
      ConfigSchema.parse({
        plugins: {
          entries: {}
        }
      }),
      configPath
    );

    const app = createUiRouter({
      kernel: createRouterTestKernel(),
      configPath,
      appEventBus: new EventBus(),
      marketplace: {
        installer: {}
      }
    });

    const response = await app.request("http://localhost/api/marketplace/skills/manage", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        type: "plugin",
        action: "disable",
        id: "@community/discord-channel"
      })
    });

    expect(response.status).toBe(400);
    const payload = await response.json() as {
      ok: boolean;
      error: {
        code: string;
      };
    };

    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("INVALID_BODY");
  });

  it("does not expose shared recommendations route", async () => {
    const configPath = createTempConfigPath();
    saveConfig(
      ConfigSchema.parse({
        plugins: {
          entries: {}
        }
      }),
      configPath
    );

    const app = createUiRouter({
      kernel: createRouterTestKernel(),
      configPath,
      appEventBus: new EventBus(),
    });

    const response = await app.request("http://localhost/api/marketplace/recommendations");
    expect(response.status).toBe(404);
  });

  it("proxies typed recommendations route to typed worker endpoint", async () => {
    const configPath = createTempConfigPath();
    saveConfig(
      ConfigSchema.parse({
        plugins: {
          entries: {}
        }
      }),
      configPath
    );

    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          ok: true,
          data: {
            type: "plugin",
            sceneId: "default",
            title: "Default Picks",
            total: 0,
            items: []
          }
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const app = createUiRouter({
      kernel: createRouterTestKernel(),
      configPath,
      appEventBus: new EventBus(),
      marketplace: {
        apiBaseUrl: "http://marketplace.example"
      }
    });

    const response = await app.request("http://localhost/api/marketplace/plugins/recommendations?scene=default&limit=3");
    expect(response.status).toBe(200);

    const payload = await response.json() as {
      ok: boolean;
      data: {
        type: string;
      };
    };
    expect(payload.ok).toBe(true);
    expect(payload.data.type).toBe("plugin");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstCall = fetchMock.mock.calls.at(0);
    if (!firstCall) {
      throw new Error("fetch was not called");
    }
    const [target] = firstCall as unknown as [Request | string];
    const url = typeof target === "string" ? target : target.url;
    expect(url).toContain("/api/v1/plugins/recommendations");
    expect(url).not.toContain("/api/v1/recommendations?");
  });

});

describe("skill marketplace scenes", () => {
  it("exposes skill marketplace scenes without item type coupling", async () => {
    const configPath = createTempConfigPath();
    saveConfig(
      ConfigSchema.parse({
        plugins: {
          entries: {}
        }
      }),
      configPath
    );

    const app = createUiRouter({
      kernel: createRouterTestKernel(),
      configPath,
      appEventBus: new EventBus()
    });
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            scenes: [
              {
                scene: "development-debugging",
                title: "Development",
                description: "Review, debug, analyze, and verify delivery work.",
                count: 1
              }
            ]
          }
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    ));

    const response = await app.request("http://localhost/api/marketplace/skills/scenes");
    expect(response.status).toBe(200);
    const payload = await response.json() as {
      ok: boolean;
      data: {
        scenes: Array<{
          scene: string;
          title: string;
          count?: number;
          type?: string;
        }>;
      };
    };

    expect(payload.ok).toBe(true);
    expect(payload.data.scenes[0]).toMatchObject({
      scene: "development-debugging",
      title: "Development",
      count: 1
    });
    expect(payload.data.scenes[0]?.type).toBeUndefined();
  });

  it("filters skill marketplace items by scene", async () => {
    const configPath = createTempConfigPath();
    saveConfig(
      ConfigSchema.parse({
        plugins: {
          entries: {}
        }
      }),
      configPath
    );

    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          ok: true,
          data: {
            total: 1,
            page: 1,
            pageSize: 20,
            totalPages: 1,
            sort: "relevance",
            items: [
              createMarketplaceSkillItem({
                id: "skill-code-review",
                slug: "code-review",
                name: "Code Review",
                tags: ["code", "review"]
              }),
            ]
          }
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const app = createUiRouter({
      kernel: createRouterTestKernel(),
      configPath,
      appEventBus: new EventBus(),
      marketplace: {
        apiBaseUrl: "http://marketplace.example"
      }
    });

    const response = await app.request("http://localhost/api/marketplace/skills/items?scene=development-debugging");
    expect(response.status).toBe(200);
    const payload = await response.json() as {
      ok: boolean;
      data: {
        total: number;
        items: Array<{
          slug: string;
        }>;
      };
    };

    expect(payload.ok).toBe(true);
    expect(payload.data.total).toBe(1);
    expect(payload.data.items.map((item) => item.slug)).toEqual(["code-review"]);
    const [target] = fetchMock.mock.calls[0] as unknown as [Request | string];
    const url = typeof target === "string" ? target : target.url;
    expect(url).toContain("scene=development-debugging");
  });

  it("uses requested marketplace page for plain skill item lists", async () => {
    const configPath = createTempConfigPath();
    saveConfig(
      ConfigSchema.parse({
        plugins: {
          entries: {}
        }
      }),
      configPath
    );

    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          ok: true,
          data: {
            total: 2,
            page: 2,
            pageSize: 12,
            totalPages: 3,
            sort: "relevance",
            items: [
              createMarketplaceSkillItem({
                id: "skill-calendar-sync",
                slug: "calendar-sync",
                name: "Calendar Sync",
                tags: ["calendar"]
              })
            ]
          }
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const app = createUiRouter({
      kernel: createRouterTestKernel(),
      configPath,
      appEventBus: new EventBus(),
      marketplace: {
        apiBaseUrl: "http://marketplace.example"
      }
    });

    const response = await app.request("http://localhost/api/marketplace/skills/items?sort=relevance&page=2&pageSize=12");
    expect(response.status).toBe(200);

    const [target] = fetchMock.mock.calls[0] as unknown as [Request | string];
    const url = typeof target === "string" ? target : target.url;
    expect(url).toContain("page=2");
    expect(url).toContain("pageSize=12");
  });

});

function createMarketplaceSkillItem(overrides: {
  id: string;
  slug: string;
  name: string;
  tags: string[];
}) {
  return {
    id: overrides.id,
    slug: overrides.slug,
    type: "skill",
    name: overrides.name,
    summary: `${overrides.name} summary`,
    summaryI18n: {
      en: `${overrides.name} summary`
    },
    tags: overrides.tags,
    author: "NextClaw",
    install: {
      kind: "marketplace",
      spec: `@nextclaw/${overrides.slug}`,
      command: `nextclaw skills install @nextclaw/${overrides.slug}`
    },
    updatedAt: "2026-03-17T00:00:00.000Z"
  };
}
