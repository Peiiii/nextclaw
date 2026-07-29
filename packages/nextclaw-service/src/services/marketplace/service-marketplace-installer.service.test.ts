import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ConfigSchema,
  getSkillsPath,
  getWorkspacePath,
  saveConfig,
} from "@nextclaw/core";
import { createUiRouter } from "@nextclaw/server";
import { EventBus } from "@nextclaw/shared";
import { afterEach, describe, expect, it } from "vitest";
import { ServiceMarketplaceInstaller } from "@nextclaw-service/services/marketplace/service-marketplace-installer.service.js";

const originalNextclawHome = process.env.NEXTCLAW_HOME;
const cleanupDirs: string[] = [];

afterEach(() => {
  if (originalNextclawHome === undefined) {
    delete process.env.NEXTCLAW_HOME;
  } else {
    process.env.NEXTCLAW_HOME = originalNextclawHome;
  }
  while (cleanupDirs.length > 0) {
    rmSync(cleanupDirs.pop()!, { recursive: true, force: true });
  }
});

function createMarketplaceApp(): {
  app: ReturnType<typeof createUiRouter>;
  workspace: string;
} {
  const home = mkdtempSync(join(tmpdir(), "nextclaw-marketplace-uninstall-"));
  cleanupDirs.push(home);
  process.env.NEXTCLAW_HOME = home;
  const configPath = join(home, "config.json");
  const config = ConfigSchema.parse({});
  saveConfig(config, configPath);
  const workspace = getWorkspacePath(config.agents.defaults.workspace);
  const installer = new ServiceMarketplaceInstaller({
    installBuiltinSkill: () => null,
    runCliSubcommand: async () => "",
  }).createInstaller();

  return {
    app: createUiRouter({
      kernel: {
        agentRuntimeManager: {},
        assetStore: {},
        ingress: {},
        llmProviders: {},
        sessionManager: {},
        sessionRunManager: {},
      } as never,
      configPath,
      appEventBus: new EventBus(),
      marketplace: { installer },
    }),
    workspace,
  };
}

async function uninstallSkill(
  app: ReturnType<typeof createUiRouter>,
  id: string,
): Promise<Response> {
  return await app.request("http://localhost/api/marketplace/skills/manage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      type: "skill",
      action: "uninstall",
      id,
    }),
  });
}

describe("ServiceMarketplaceInstaller skill uninstall", () => {
  it.each([
    "../proof-victim",
    "..",
    ".",
    String.raw`..\proof-victim`,
    "@scope/..",
  ])(
    "rejects an uninstall target outside a direct workspace skill child: %s",
    async (id) => {
      const { app, workspace } = createMarketplaceApp();
      const skillsRoot = getSkillsPath(workspace);
      const safeSkillDir = join(skillsRoot, "safe-skill");
      const victimDir = join(workspace, "proof-victim");
      mkdirSync(safeSkillDir, { recursive: true });
      mkdirSync(victimDir, { recursive: true });
      writeFileSync(join(safeSkillDir, "SKILL.md"), "safe");
      writeFileSync(join(victimDir, "proof.txt"), "safe");

      const response = await uninstallSkill(app, id);

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        ok: false,
        error: {
          code: "MANAGE_FAILED",
          message: expect.any(String),
        },
      });
      expect(existsSync(join(safeSkillDir, "SKILL.md"))).toBe(true);
      expect(existsSync(join(victimDir, "proof.txt"))).toBe(true);
    },
  );

  it("removes a valid direct workspace skill directory", async () => {
    const { app, workspace } = createMarketplaceApp();
    const skillsRoot = getSkillsPath(workspace);
    const skillDir = join(skillsRoot, "weather");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "weather");

    const response = await uninstallSkill(app, "weather");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      data: {
        type: "skill",
        action: "uninstall",
        id: "weather",
        message: "Uninstalled skill: weather",
      },
    });
    expect(existsSync(skillDir)).toBe(false);
    expect(existsSync(skillsRoot)).toBe(true);
  });

  it("preserves a direct workspace skills entry without a skill manifest", async () => {
    const { app, workspace } = createMarketplaceApp();
    const unmanagedDir = join(getSkillsPath(workspace), "unmanaged-data");
    mkdirSync(unmanagedDir, { recursive: true });
    writeFileSync(join(unmanagedDir, "proof.txt"), "safe");

    const response = await uninstallSkill(app, "unmanaged-data");

    expect(response.status).toBe(400);
    expect(existsSync(join(unmanagedDir, "proof.txt"))).toBe(true);
  });
});
