import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig, saveConfig } from "./loader.js";
import { ConfigSchema } from "./schema.js";
import {
  createAgentProfile,
  resolveAgentAvatarHomePath,
  resolveEffectiveAgentProfiles,
  updateAgentProfile
} from "./agent-profiles.js";

const tempDirs: string[] = [];

function createTempConfigPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-agent-profiles-test-"));
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
});

describe("agent profiles", () => {
  it("creates a new agent with default home and generated avatar", () => {
    const configPath = createTempConfigPath();
    const workspace = join(dirname(configPath), "workspace");
    saveConfig(
      ConfigSchema.parse({
        agents: {
          defaults: {
            workspace
          }
        }
      }),
      configPath
    );

    const created = createAgentProfile(
      {
        id: "engineer"
      },
      {
        configPath
      }
    );

    expect(created.id).toBe("engineer");
    expect(created.displayName).toBe("Engineer");
    expect(created.workspace).toBe(`${workspace}-engineer`);
    expect(created.avatar).toBe("home://avatar.svg");
    expect(existsSync(join(created.workspace, "avatar.svg"))).toBe(true);
    expect(readFileSync(join(created.workspace, "avatar.svg"), "utf-8")).toContain("<svg");

    const saved = loadConfig(configPath);
    expect(resolveEffectiveAgentProfiles(saved).map((agent) => agent.id)).toEqual(["main", "engineer"]);
  });

  it("persists agent description when provided", () => {
    const configPath = createTempConfigPath();
    const workspace = join(dirname(configPath), "workspace");
    saveConfig(
      ConfigSchema.parse({
        agents: {
          defaults: {
            workspace
          }
        }
      }),
      configPath
    );

    const created = createAgentProfile(
      {
        id: "researcher",
        description: "负责调研、信息筛选与结论提炼。"
      },
      {
        configPath
      }
    );

    expect(created.description).toBe("负责调研、信息筛选与结论提炼。");

    const saved = loadConfig(configPath);
    const researcher = resolveEffectiveAgentProfiles(saved).find((agent) => agent.id === "researcher");
    expect(researcher?.description).toBe("负责调研、信息筛选与结论提炼。");
  });

  it("updates an existing extra agent profile", () => {
    const configPath = createTempConfigPath();
    const workspace = join(dirname(configPath), "workspace");
    saveConfig(
      ConfigSchema.parse({
        agents: {
          defaults: {
            workspace
          },
          list: [
            {
              id: "researcher",
              workspace: `${workspace}-researcher`,
              displayName: "Researcher",
              description: "旧描述",
              avatar: "https://example.com/old.png"
            }
          ]
        }
      }),
      configPath
    );

    const updated = updateAgentProfile(
      {
        id: "researcher",
        displayName: "Deep Researcher",
        description: "负责深度调研与结论整合。",
        avatar: ""
      },
      {
        configPath
      }
    );

    expect(updated.displayName).toBe("Deep Researcher");
    expect(updated.description).toBe("负责深度调研与结论整合。");
    expect(updated.avatar).toBeUndefined();

    const saved = loadConfig(configPath);
    const researcher = resolveEffectiveAgentProfiles(saved).find((agent) => agent.id === "researcher");
    expect(researcher).toMatchObject({
      id: "researcher",
      displayName: "Deep Researcher",
      description: "负责深度调研与结论整合。"
    });
    expect(researcher?.avatar).toBeUndefined();
  });

  it("creates a main override when updating the built-in main agent", () => {
    const configPath = createTempConfigPath();
    const workspace = join(dirname(configPath), "workspace");
    saveConfig(
      ConfigSchema.parse({
        agents: {
          defaults: {
            workspace
          }
        }
      }),
      configPath
    );

    const updated = updateAgentProfile(
      {
        id: "main",
        description: "负责全局统筹与默认处理。"
      },
      {
        configPath
      }
    );

    expect(updated.id).toBe("main");
    expect(updated.description).toBe("负责全局统筹与默认处理。");

    const saved = loadConfig(configPath);
    const mainEntry = saved.agents.list.find((agent) => agent.id === "main");
    expect(mainEntry?.description).toBe("负责全局统筹与默认处理。");
  });

  it("rejects avatar refs that escape the agent home directory", () => {
    expect(() =>
      resolveAgentAvatarHomePath({
        homeDirectory: "/tmp/agent-home",
        avatarRef: "home://../../etc/passwd"
      })
    ).toThrow("avatar ref escapes agent home directory");
  });
});
