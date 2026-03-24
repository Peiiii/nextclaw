/* eslint-disable max-lines-per-function */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { createUiRouter } from "./router.js";

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
      configPath,
      publish: () => {},
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
              id: "plugin-channel-discord",
              slug: "channel-plugin-discord",
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
                spec: "@nextclaw/channel-plugin-discord",
                command: "nextclaw plugins install @nextclaw/channel-plugin-discord"
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
          name: "@nextclaw/channel-plugin-discord",
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
      configPath,
      publish: () => {},
      marketplace: {
        apiBaseUrl: "http://marketplace.example"
      }
    });

    const response = await app.request("http://localhost/api/marketplace/plugins/items/channel-plugin-discord/content");
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
      configPath,
      publish: () => {},
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
                id: "plugin-channel-discord",
                slug: "channel-plugin-discord",
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
                  spec: "@nextclaw/channel-plugin-discord",
                  command: "nextclaw plugins install @nextclaw/channel-plugin-discord"
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
      configPath,
      publish: () => {},
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

  it("exposes non-channel npm plugins in marketplace plugin list", async () => {
    const workspaceDir = createTempDir("nextclaw-ui-plugin-list-runtime-plugin-");
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
                id: "plugin-ncp-runtime-codex-sdk",
                slug: "ncp-runtime-plugin-codex-sdk",
                type: "plugin",
                name: "Codex SDK NCP Runtime Plugin",
                summary: "Optional NextClaw plugin that adds a Codex-powered NCP session type.",
                summaryI18n: {
                  en: "Optional NextClaw plugin that adds a Codex-powered NCP session type.",
                  zh: "为 NextClaw 提供 Codex 驱动 NCP 会话类型的可选插件。"
                },
                description: "Registers a pluggable Codex SDK runtime for NCP.",
                tags: ["plugin", "agent-runtime", "ncp", "codex"],
                author: "NextClaw",
                install: {
                  kind: "npm",
                  spec: "@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk",
                  command: "nextclaw plugins install @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk"
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
      configPath,
      publish: () => {},
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
    expect(payload.data.items[0]?.slug).toBe("ncp-runtime-plugin-codex-sdk");
    expect(payload.data.items[0]?.install.spec).toBe("@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk");
  });

  it("exposes claude runtime plugins in marketplace plugin list", async () => {
    const workspaceDir = createTempDir("nextclaw-ui-plugin-list-claude-runtime-");
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
                id: "plugin-ncp-runtime-claude-code-sdk",
                slug: "ncp-runtime-plugin-claude-code-sdk",
                type: "plugin",
                name: "Claude NCP Runtime Plugin",
                summary: "Optional NextClaw plugin that adds a Claude-powered NCP session type.",
                summaryI18n: {
                  en: "Optional NextClaw plugin that adds a Claude-powered NCP session type.",
                  zh: "为 NextClaw 提供 Claude 驱动 NCP 会话类型的可选插件。"
                },
                description: "Registers a pluggable Claude runtime for NCP.",
                tags: ["plugin", "agent-runtime", "ncp", "claude", "anthropic"],
                author: "NextClaw",
                install: {
                  kind: "npm",
                  spec: "@nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk",
                  command: "nextclaw plugins install @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk"
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
      configPath,
      publish: () => {},
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
    expect(payload.data.items[0]?.slug).toBe("ncp-runtime-plugin-claude-code-sdk");
    expect(payload.data.items[0]?.install.spec).toBe("@nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk");
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
                id: "plugin-channel-discord",
                slug: "channel-plugin-discord",
                type: "plugin",
                name: "Discord Channel Plugin",
                summary: "English summary",
                tags: ["plugin", "discord"],
                author: "NextClaw",
                install: {
                  kind: "npm",
                  spec: "@nextclaw/channel-plugin-discord",
                  command: "nextclaw plugins install @nextclaw/channel-plugin-discord"
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
      configPath,
      publish: () => {},
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
