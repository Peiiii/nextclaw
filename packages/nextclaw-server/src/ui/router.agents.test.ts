import { mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, loadConfig, saveConfig } from "@nextclaw/core";
import { createUiRouter } from "./router.js";
import { EventBus } from "@nextclaw/kernel";

const tempDirs: string[] = [];

function createTempConfigPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-ui-agents-test-"));
  tempDirs.push(dir);
  return join(dir, "config.json");
}

afterEach(() => {
  vi.restoreAllMocks();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("agents routes", () => {
  it("creates an agent and serves its generated avatar", async () => {
    const configPath = createTempConfigPath();
    const homeDir = join(dirname(configPath), "workspace");
    saveConfig(
      ConfigSchema.parse({
        agents: {
          defaults: {
            workspace: homeDir
          }
        }
      }),
      configPath
    );
    const appEventBus = new EventBus();
    const emitAppEvent = vi.spyOn(appEventBus, "emit");

    const app = createUiRouter({
      configPath,
      appEventBus
    });

    const createResponse = await app.request("http://localhost/api/agents", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        id: "researcher",
        displayName: "Researcher",
        description: "Handles research briefs and source synthesis.",
        model: "openai/gpt-5.2"
      })
    });

    expect(createResponse.status).toBe(200);
    const createPayload = await createResponse.json() as {
      ok: true;
      data: { id: string; avatarUrl?: string; description?: string; model?: string };
    };
    expect(createPayload.data.id).toBe("researcher");
    expect(createPayload.data.description).toBe("Handles research briefs and source synthesis.");
    expect(createPayload.data.model).toBe("openai/gpt-5.2");
    expect(createPayload.data.avatarUrl).toBe("/api/agents/researcher/avatar");
    expect(emitAppEvent).toHaveBeenCalledWith(
      expect.objectContaining({ id: "config.updated" }),
      { path: "agents.list" },
      expect.any(Object)
    );

    const saved = loadConfig(configPath);
    expect(saved.agents.list.some((entry) => entry.id === "researcher")).toBe(true);
    expect(saved.agents.list.find((entry) => entry.id === "researcher")?.description).toBe(
      "Handles research briefs and source synthesis."
    );
    expect(saved.agents.list.find((entry) => entry.id === "researcher")?.model).toBe("openai/gpt-5.2");

    const avatarResponse = await app.request("http://localhost/api/agents/researcher/avatar");
    expect(avatarResponse.status).toBe(200);
    expect(avatarResponse.headers.get("content-type")).toBe("image/svg+xml");
    expect(await avatarResponse.text()).toContain("<svg");
  });

  it("rejects reserved built-in agent deletion", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    const app = createUiRouter({
      configPath,
      appEventBus: new EventBus(),
    });

    const response = await app.request("http://localhost/api/agents/main", {
      method: "DELETE"
    });

    expect(response.status).toBe(400);
  });

  it("updates an existing custom agent profile", async () => {
    const configPath = createTempConfigPath();
    const homeDir = join(dirname(configPath), "workspace");
    saveConfig(
      ConfigSchema.parse({
        agents: {
          defaults: {
            workspace: homeDir
          },
          list: [
            {
              id: "researcher",
              displayName: "Researcher",
              description: "Old description",
              avatar: "https://example.com/old.png"
            }
          ]
        }
      }),
      configPath
    );
    const appEventBus = new EventBus();
    const emitAppEvent = vi.spyOn(appEventBus, "emit");
    const app = createUiRouter({
      configPath,
      appEventBus
    });

    const response = await app.request("http://localhost/api/agents/researcher", {
      method: "PUT",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        displayName: "Deep Researcher",
        description: "Handles deep research briefs.",
        avatar: "",
        model: "anthropic/claude-sonnet-4.5",
        runtime: "codex"
      })
    });

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      ok: true;
      data: { id: string; displayName?: string; description?: string; avatar?: string; avatarUrl?: string; model?: string; runtime?: string };
    };
    expect(payload.data).toMatchObject({
      id: "researcher",
      displayName: "Deep Researcher",
      description: "Handles deep research briefs.",
      model: "anthropic/claude-sonnet-4.5",
      runtime: "codex"
    });
    expect(payload.data.avatar).toBeUndefined();
    expect(payload.data.avatarUrl).toBeUndefined();
    expect(emitAppEvent).toHaveBeenCalledWith(
      expect.objectContaining({ id: "config.updated" }),
      { path: "agents.list" },
      expect.any(Object)
    );

    const saved = loadConfig(configPath);
    const researcher = saved.agents.list.find((entry) => entry.id === "researcher");
    expect(researcher?.displayName).toBe("Deep Researcher");
    expect(researcher?.description).toBe("Handles deep research briefs.");
    expect(researcher?.avatar).toBeUndefined();
    expect(researcher?.model).toBe("anthropic/claude-sonnet-4.5");
    expect(researcher?.engine).toBe("codex");
  });

  it("updates the built-in main agent through a config override", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    const app = createUiRouter({
      configPath,
      appEventBus: new EventBus(),
    });

    const response = await app.request("http://localhost/api/agents/main", {
      method: "PUT",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        description: "负责全局统筹与默认处理。"
      })
    });

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      ok: true;
      data: { id: string; description?: string; builtIn?: boolean };
    };
    expect(payload.data).toMatchObject({
      id: "main",
      description: "负责全局统筹与默认处理。",
      builtIn: true
    });
    expect(loadConfig(configPath).agents.list.find((entry) => entry.id === "main")?.description).toBe(
      "负责全局统筹与默认处理。"
    );
  });

  it("lists the inferred nested home for extra agents without explicit workspace", async () => {
    const configPath = createTempConfigPath();
    const homeDir = join(dirname(configPath), "workspace");
    saveConfig(
      ConfigSchema.parse({
        agents: {
          defaults: {
            workspace: homeDir
          },
          list: [
            {
              id: "laowizard"
            }
          ]
        }
      }),
      configPath
    );
    const app = createUiRouter({
      configPath,
      appEventBus: new EventBus(),
    });

    const response = await app.request("http://localhost/api/agents");

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      ok: true;
      data: { agents: Array<{ id: string; workspace?: string }> };
    };
    expect(payload.data.agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "laowizard",
          workspace: join(homeDir, "agents", "laowizard")
        })
      ])
    );
  });
});
