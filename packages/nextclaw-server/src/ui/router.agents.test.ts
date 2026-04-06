import { mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, loadConfig, saveConfig } from "@nextclaw/core";
import { createUiRouter } from "./router.js";

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
    const publish = vi.fn();

    const app = createUiRouter({
      configPath,
      publish
    });

    const createResponse = await app.request("http://localhost/api/agents", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        id: "researcher",
        displayName: "Researcher",
        description: "Handles research briefs and source synthesis."
      })
    });

    expect(createResponse.status).toBe(200);
    const createPayload = await createResponse.json() as {
      ok: true;
      data: { id: string; avatarUrl?: string; description?: string };
    };
    expect(createPayload.data.id).toBe("researcher");
    expect(createPayload.data.description).toBe("Handles research briefs and source synthesis.");
    expect(createPayload.data.avatarUrl).toBe("/api/agents/researcher/avatar");
    expect(publish).toHaveBeenCalledWith({
      type: "config.updated",
      payload: { path: "agents.list" }
    });

    const saved = loadConfig(configPath);
    expect(saved.agents.list.some((entry) => entry.id === "researcher")).toBe(true);
    expect(saved.agents.list.find((entry) => entry.id === "researcher")?.description).toBe(
      "Handles research briefs and source synthesis."
    );

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
      publish: vi.fn()
    });

    const response = await app.request("http://localhost/api/agents/main", {
      method: "DELETE"
    });

    expect(response.status).toBe(400);
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
      publish: vi.fn()
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
