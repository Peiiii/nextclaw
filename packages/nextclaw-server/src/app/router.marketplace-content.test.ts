/* eslint-disable max-lines-per-function */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { createUiRouter } from "./router.js";
import { createRouterTestKernel } from "@nextclaw-server/app/tests/router-test-kernel.js";
import { EventBus } from "@nextclaw/shared";

const tempDirs: string[] = [];

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
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

describe("marketplace content routes", () => {
  it("returns full skill markdown content with metadata and body", async () => {
    const workspaceDir = createTempDir("nextclaw-ui-skill-content-");
    const configPath = join(workspaceDir, "config.json");
    const skillDir = join(workspaceDir, "skills", "weather");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, "SKILL.md"),
      `---\nname: weather\ndescription: Local weather skill\n---\n\n# Weather Skill\n\nUse this skill for weather lookups.\n`
    );

    saveConfig(
      ConfigSchema.parse({
        agents: {
          defaults: {
            workspace: workspaceDir
          }
        }
      }),
      configPath
    );

    const fetchMock = vi.fn(async (target: Request | string) => {
      const url = typeof target === "string" ? target : target.url;
      if (url.includes("/api/v1/skills/items/weather/content")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              type: "skill",
              slug: "weather",
              name: "Weather",
              install: {
                kind: "marketplace",
                spec: "weather",
                command: "nextclaw skills install weather"
              },
              source: "marketplace",
              raw: `---\nname: weather\ndescription: Local weather skill\n---\n\n# Weather Skill\n\nUse this skill for weather lookups.\n`,
              metadataRaw: "name: weather\\ndescription: Local weather skill",
              bodyRaw: "# Weather Skill\\n\\nUse this skill for weather lookups.\\n"
            }
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        );
      }
      return new Response(
        JSON.stringify({
          ok: true,
          data: {
            id: "skill-weather",
            slug: "weather",
            type: "skill",
            name: "Weather",
            summary: "Weather summary",
            summaryI18n: {
              en: "Weather summary",
              zh: "天气摘要"
            },
            tags: ["skill"],
            author: "NextClaw",
            install: {
              kind: "marketplace",
              spec: "weather",
              command: "nextclaw skills install weather"
            },
            updatedAt: "2026-02-16T09:10:00.000Z",
            publishedAt: "2025-07-10T10:00:00.000Z"
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

    const response = await app.request("http://localhost/api/marketplace/skills/items/weather/content");
    expect(response.status).toBe(200);

    const payload = await response.json() as {
      ok: boolean;
      data: {
        metadataRaw?: string;
        bodyRaw: string;
      };
    };

    expect(payload.ok).toBe(true);
    expect(payload.data.metadataRaw).toContain("name: weather");
    expect(payload.data.bodyRaw).toContain("# Weather Skill");
  });

  it("returns plugin readme-style content", async () => {
    const workspaceDir = createTempDir("nextclaw-ui-plugin-content-");
    const configPath = join(workspaceDir, "config.json");

    saveConfig(
      ConfigSchema.parse({
        agents: {
          defaults: {
            workspace: workspaceDir
          }
        }
      }),
      configPath
    );

    const fetchMock = vi.fn(async (target: Request | string) => {
      const url = typeof target === "string" ? target : target.url;

      if (url.includes("/api/v1/plugins/items/")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              id: "extension-channel-discord",
              slug: "channel-extension-discord",
              type: "plugin",
              name: "Discord Channel Plugin",
              summary: "Discord summary",
              summaryI18n: {
                en: "Discord summary",
                zh: "Discord 摘要"
              },
              description: "Plugin description",
              tags: ["plugin", "discord"],
              author: "NextClaw",
              install: {
                kind: "npm",
                spec: "@nextclaw/channel-extension-discord",
                command: "Install from NextClaw Marketplace"
              },
              updatedAt: "2026-02-22T09:40:00.000Z",
              publishedAt: "2025-12-10T10:00:00.000Z"
            }
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        );
      }

      return new Response(
        JSON.stringify({
          name: "@nextclaw/channel-extension-discord",
          description: "Discord plugin",
          readme: "# Discord Plugin\n\nREADME content"
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

    const response = await app.request("http://localhost/api/marketplace/plugins/items/channel-extension-discord/content");
    expect(response.status).toBe(200);

    const payload = await response.json() as {
      ok: boolean;
      data: {
        bodyRaw?: string;
      };
    };

    expect(payload.ok).toBe(true);
    expect(payload.data.bodyRaw).toContain("# Discord Plugin");

    expect(fetchMock).toHaveBeenCalled();
    const urls = fetchMock.mock.calls.map((call) => {
      const [target] = call as unknown as [Request | string];
      return typeof target === "string" ? target : target.url;
    });
    expect(urls.some((url) => url.includes("registry.npmjs.org"))).toBe(true);
  });

  it("returns contract mismatch when marketplace skill install kind is unsupported", async () => {
    const workspaceDir = createTempDir("nextclaw-ui-skill-list-contract-");
    const configPath = join(workspaceDir, "config.json");

    saveConfig(
      ConfigSchema.parse({
        agents: {
          defaults: {
            workspace: workspaceDir
          }
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
            pageSize: 50,
            totalPages: 1,
            sort: "relevance",
            items: [
              {
                id: "skill-pdf-anthropic",
                slug: "pdf",
                type: "skill",
                name: "PDF Toolkit",
                summary: "PDF summary",
                tags: ["skill", "pdf"],
                author: "Anthropic",
                install: {
                  kind: "git",
                  spec: "anthropics/skills/skills/pdf",
                  command: "npx skild install anthropics/skills/skills/pdf --target agents --local --skill pdf"
                },
                updatedAt: "2026-02-27T23:05:50.000Z",
                publishedAt: "2025-06-01T10:00:00.000Z"
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

    const response = await app.request("http://localhost/api/marketplace/skills/items?page=1&pageSize=10");
    expect(response.status).toBe(502);

    const payload = await response.json() as {
      ok: boolean;
      error: {
        code: string;
        message: string;
      };
    };
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("MARKETPLACE_CONTRACT_MISMATCH");
    expect(payload.error.message).toContain("unsupported skill install kind");
    expect(payload.error.message).toContain("git");
  });

  it("retries transient marketplace fetch failures before returning skill catalog data", async () => {
    const workspaceDir = createTempDir("nextclaw-ui-skill-list-retry-");
    const configPath = join(workspaceDir, "config.json");

    saveConfig(
      ConfigSchema.parse({
        agents: {
          defaults: {
            workspace: workspaceDir
          }
        }
      }),
      configPath
    );

    let calls = 0;
    const fetchMock = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        const error = new TypeError("fetch failed");
        (error as Error & { cause?: unknown }).cause = Object.assign(new Error("read ECONNRESET"), {
          code: "ECONNRESET",
          errno: -54,
          syscall: "read"
        });
        throw error;
      }

      return new Response(
        JSON.stringify({
          ok: true,
          data: {
            total: 1,
            page: 1,
            pageSize: 50,
            totalPages: 1,
            sort: "relevance",
            items: [
              {
                id: "skill-lark-cli",
                slug: "lark-cli",
                type: "skill",
                name: "Lark CLI",
                summary: "Operate larksuite/cli from NextClaw.",
                summaryI18n: {
                  en: "Operate larksuite/cli from NextClaw.",
                  zh: "在 NextClaw 中使用 larksuite/cli。"
                },
                tags: ["skill", "lark-cli"],
                author: "NextClaw",
                install: {
                  kind: "marketplace",
                  spec: "lark-cli",
                  command: "nextclaw skills install lark-cli"
                },
                updatedAt: "2026-03-29T09:58:18.017Z",
                publishedAt: "2026-03-29T09:58:18.017Z"
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

    const response = await app.request("http://localhost/api/marketplace/skills/items?page=1&pageSize=10");
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
    expect(payload.data.items[0]?.slug).toBe("lark-cli");
    expect(calls).toBe(2);
  });

  it("normalizes locale-family summary fields for marketplace list responses", async () => {
    const workspaceDir = createTempDir("nextclaw-ui-plugin-list-i18n-");
    const configPath = join(workspaceDir, "config.json");

    saveConfig(
      ConfigSchema.parse({
        agents: {
          defaults: {
            workspace: workspaceDir
          }
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
            pageSize: 50,
            totalPages: 1,
            sort: "relevance",
            items: [
              {
                id: "extension-channel-discord",
                slug: "channel-extension-discord",
                type: "plugin",
                name: "Discord Channel Plugin",
                summary: "English summary",
                summaryI18n: {
                  "en-US": "English summary",
                  "zh-CN": "中文摘要"
                },
                description: "Description",
                tags: ["plugin", "discord"],
                author: "NextClaw",
                install: {
                  kind: "npm",
                  spec: "@nextclaw/channel-extension-discord",
                  command: "Install from NextClaw Marketplace"
                },
                updatedAt: "2026-02-22T09:40:00.000Z",
                publishedAt: "2025-12-10T10:00:00.000Z"
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

    const response = await app.request("http://localhost/api/marketplace/plugins/items?page=1&pageSize=10");
    expect(response.status).toBe(200);

    const payload = await response.json() as {
      ok: boolean;
      data: {
        items: Array<{
          summaryI18n: Record<string, string>;
        }>;
      };
    };

    expect(payload.ok).toBe(true);
    expect(payload.data.items[0]?.summaryI18n.zh).toBe("中文摘要");
    expect(payload.data.items[0]?.summaryI18n.en).toBe("English summary");
  });

  it("exposes npm plugins in marketplace plugin list", async () => {
    const workspaceDir = createTempDir("nextclaw-ui-plugin-list-channel-extension-");
    const configPath = join(workspaceDir, "config.json");

    saveConfig(
      ConfigSchema.parse({
        agents: {
          defaults: {
            workspace: workspaceDir
          }
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
            pageSize: 50,
            totalPages: 1,
            sort: "relevance",
            items: [
              {
                id: "extension-channel-slack",
                slug: "channel-extension-slack",
                type: "plugin",
                name: "Slack Channel Plugin",
                summary: "Optional NextClaw plugin that adds Slack channel integration.",
                summaryI18n: {
                  en: "Optional NextClaw plugin that adds Slack channel integration.",
                  zh: "为 NextClaw 提供 Slack 渠道集成的可选插件。"
                },
                description: "Registers a pluggable Slack channel.",
                tags: ["plugin", "channel", "slack"],
                author: "NextClaw",
                install: {
                  kind: "npm",
                  spec: "@nextclaw/channel-extension-slack",
                  command: "Install from NextClaw Marketplace"
                },
                updatedAt: "2026-03-19T00:00:00.000Z",
                publishedAt: "2026-03-19T00:00:00.000Z"
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

    const response = await app.request("http://localhost/api/marketplace/plugins/items?page=1&pageSize=10");
    expect(response.status).toBe(200);

    const payload = await response.json() as {
      ok: boolean;
      data: {
        total: number;
        items: Array<{
          slug: string;
          install: {
            spec: string;
          };
        }>;
      };
    };

    expect(payload.ok).toBe(true);
    expect(payload.data.total).toBe(1);
    expect(payload.data.items[0]?.slug).toBe("channel-extension-slack");
    expect(payload.data.items[0]?.install.spec).toBe("@nextclaw/channel-extension-slack");
  });

  it("exposes another channel plugin in marketplace plugin list", async () => {
    const workspaceDir = createTempDir("nextclaw-ui-plugin-list-channel-discord-");
    const configPath = join(workspaceDir, "config.json");

    saveConfig(
      ConfigSchema.parse({
        agents: {
          defaults: {
            workspace: workspaceDir
          }
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
            pageSize: 50,
            totalPages: 1,
            sort: "relevance",
            items: [
              {
                id: "extension-channel-discord",
                slug: "channel-extension-discord",
                type: "plugin",
                name: "Discord Channel Plugin",
                summary: "Optional NextClaw plugin that adds Discord channel integration.",
                summaryI18n: {
                  en: "Optional NextClaw plugin that adds Discord channel integration.",
                  zh: "为 NextClaw 提供 Discord 渠道集成的可选插件。"
                },
                description: "Registers a pluggable Discord channel.",
                tags: ["plugin", "channel", "discord", "chat"],
                author: "NextClaw",
                install: {
                  kind: "npm",
                  spec: "@nextclaw/channel-extension-discord",
                  command: "Install from NextClaw Marketplace"
                },
                updatedAt: "2026-03-19T00:00:00.000Z",
                publishedAt: "2026-03-19T00:00:00.000Z"
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

    const response = await app.request("http://localhost/api/marketplace/plugins/items?page=1&pageSize=10");
    expect(response.status).toBe(200);

    const payload = await response.json() as {
      ok: boolean;
      data: {
        total: number;
        items: Array<{
          slug: string;
          install: {
            spec: string;
          };
        }>;
      };
    };

    expect(payload.ok).toBe(true);
    expect(payload.data.total).toBe(1);
    expect(payload.data.items[0]?.slug).toBe("channel-extension-discord");
    expect(payload.data.items[0]?.install.spec).toBe("@nextclaw/channel-extension-discord");
  });

  it("forwards plugin catalog pagination without fetching the entire remote catalog", async () => {
    const workspaceDir = createTempDir("nextclaw-ui-plugin-list-paging-");
    const configPath = join(workspaceDir, "config.json");

    saveConfig(
      ConfigSchema.parse({
        agents: {
          defaults: {
            workspace: workspaceDir
          }
        }
      }),
      configPath
    );

    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          ok: true,
          data: {
            total: 24,
            page: 2,
            pageSize: 12,
            totalPages: 2,
            sort: "relevance",
            items: [
              {
                id: "extension-channel-discord",
                slug: "channel-extension-discord",
                type: "plugin",
                name: "Discord Channel Plugin",
                summary: "English summary",
                tags: ["plugin", "discord"],
                author: "NextClaw",
                install: {
                  kind: "npm",
                  spec: "@nextclaw/channel-extension-discord",
                  command: "Install from NextClaw Marketplace"
                },
                updatedAt: "2026-02-22T09:40:00.000Z",
                publishedAt: "2025-12-10T10:00:00.000Z"
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

    const response = await app.request("http://localhost/api/marketplace/plugins/items?page=2&pageSize=12");
    expect(response.status).toBe(200);

    const payload = await response.json() as {
      ok: boolean;
      data: {
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      };
    };

    expect(payload.ok).toBe(true);
    expect(payload.data.total).toBe(24);
    expect(payload.data.page).toBe(2);
    expect(payload.data.pageSize).toBe(12);
    expect(payload.data.totalPages).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const firstCall = fetchMock.mock.calls.at(0);
    if (!firstCall) {
      throw new Error("fetch was not called");
    }
    const [target] = firstCall as unknown as [Request | string];
    const url = typeof target === "string" ? target : target.url;
    expect(url).toContain("/api/v1/plugins/items");
    expect(url).toContain("page=2");
    expect(url).toContain("pageSize=12");
    expect(url).not.toContain("pageSize=100");
  });
});
