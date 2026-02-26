import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { createUiRouter } from "./router.js";

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
  it("maps canonical plugin spec to builtin plugin id when disabling", async () => {
    const configPath = createTempConfigPath();
    saveConfig(
      ConfigSchema.parse({
        plugins: {
          entries: {
            "builtin-channel-discord": {
              enabled: true
            }
          }
        }
      }),
      configPath
    );

    const disablePlugin = vi.fn(async () => ({
      message: "Disabled plugin \"builtin-channel-discord\"."
    }));

    const app = createUiRouter({
      configPath,
      publish: () => {},
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
        id: "@nextclaw/channel-plugin-discord",
        spec: "@nextclaw/channel-plugin-discord"
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
    expect(payload.data.id).toBe("builtin-channel-discord");
    expect(disablePlugin).toHaveBeenCalledTimes(1);
    expect(disablePlugin).toHaveBeenCalledWith("builtin-channel-discord");
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
      configPath,
      publish: () => {},
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
        id: "@nextclaw/channel-plugin-discord"
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
      configPath,
      publish: () => {}
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
      configPath,
      publish: () => {},
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
