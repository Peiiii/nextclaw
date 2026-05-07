import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
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

describe("createAgentProfile", () => {
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
    expect(created.workspace).toBe(join(workspace, "agents", "engineer"));
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

  it("persists agent model when provided", () => {
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
        model: "openai/gpt-5.2"
      },
      {
        configPath
      }
    );

    expect(created.model).toBe("openai/gpt-5.2");

    const saved = loadConfig(configPath);
    const researcher = resolveEffectiveAgentProfiles(saved).find((agent) => agent.id === "researcher");
    expect(researcher?.model).toBe("openai/gpt-5.2");
  });

  it("maps public runtime fields onto the stored engine fields", () => {
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
        id: "coder",
        runtime: "codex",
        runtimeConfig: {
          profile: "high"
        }
      },
      {
        configPath
      }
    );

    expect(created.runtime).toBe("codex");
    expect(created.runtimeConfig).toEqual({ profile: "high" });

    const saved = loadConfig(configPath);
    const coder = resolveEffectiveAgentProfiles(saved).find((agent) => agent.id === "coder");
    expect(coder).toMatchObject({
      runtime: "codex",
      engine: "codex",
      runtimeConfig: { profile: "high" },
      engineConfig: { profile: "high" }
    });
  });

  it("infers nested agent home when an extra agent has no explicit workspace", () => {
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
              id: "researcher"
            }
          ]
        }
      }),
      configPath
    );

    const saved = loadConfig(configPath);
    const researcher = resolveEffectiveAgentProfiles(saved).find((agent) => agent.id === "researcher");

    expect(researcher?.workspace).toBe(join(workspace, "agents", "researcher"));
  });

  it("keeps the legacy implicit agent home when only the old directory exists", () => {
    const configPath = createTempConfigPath();
    const workspace = join(dirname(configPath), "workspace");
    const legacyWorkspace = `${workspace}-researcher`;
    mkdirSync(legacyWorkspace, { recursive: true });
    saveConfig(
      ConfigSchema.parse({
        agents: {
          defaults: {
            workspace
          },
          list: [
            {
              id: "researcher"
            }
          ]
        }
      }),
      configPath
    );

    const saved = loadConfig(configPath);
    const researcher = resolveEffectiveAgentProfiles(saved).find((agent) => agent.id === "researcher");

    expect(researcher?.workspace).toBe(legacyWorkspace);
  });
});

describe("updateAgentProfile", () => {
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

  it("updates an existing agent model", () => {
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
              model: "openai/gpt-5.1"
            }
          ]
        }
      }),
      configPath
    );

    const updated = updateAgentProfile(
      {
        id: "researcher",
        model: "anthropic/claude-sonnet-4.5"
      },
      {
        configPath
      }
    );

    expect(updated.model).toBe("anthropic/claude-sonnet-4.5");

    const saved = loadConfig(configPath);
    const researcher = resolveEffectiveAgentProfiles(saved).find((agent) => agent.id === "researcher");
    expect(researcher?.model).toBe("anthropic/claude-sonnet-4.5");
  });

  it("updates agent runtime through the public runtime field", () => {
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
              engine: "native"
            }
          ]
        }
      }),
      configPath
    );

    const updated = updateAgentProfile(
      {
        id: "researcher",
        runtime: "codex"
      },
      {
        configPath
      }
    );

    expect(updated.runtime).toBe("codex");
    expect(updated.engine).toBe("codex");

    const saved = loadConfig(configPath);
    const researcher = resolveEffectiveAgentProfiles(saved).find((agent) => agent.id === "researcher");
    expect(researcher?.runtime).toBe("codex");
    expect(researcher?.engine).toBe("codex");
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
});

describe("path safety", () => {
  it("rejects avatar refs that escape the agent home directory", () => {
    expect(() =>
      resolveAgentAvatarHomePath({
        homeDirectory: "/tmp/agent-home",
        avatarRef: "home://../../etc/passwd"
      })
    ).toThrow("avatar ref escapes agent home directory");
  });
});
