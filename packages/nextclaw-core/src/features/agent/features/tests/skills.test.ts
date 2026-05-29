import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { SkillsLoader } from "@core/features/agent/services/skills-loader.js";

const tempWorkspaces: string[] = [];

function createWorkspace(): string {
  const workspace = mkdtempSync(join(tmpdir(), "nextclaw-skills-test-"));
  tempWorkspaces.push(workspace);
  return workspace;
}

afterEach(() => {
  while (tempWorkspaces.length > 0) {
    const workspace = tempWorkspaces.pop();
    if (!workspace) {
      continue;
    }
    rmSync(workspace, { recursive: true, force: true });
  }
});

describe("SkillsLoader builtin skills", () => {
  it("loads builtin skills even when the workspace has no copied skill directories", () => {
    const workspace = createWorkspace();
    const loader = new SkillsLoader(workspace);

    const skill = loader.listSkills(false).find((entry) => entry.name === "nextclaw-self-manage");

    expect(skill).toEqual(
      expect.objectContaining({
        name: "nextclaw-self-manage",
        source: "builtin",
        scope: "builtin",
      }),
    );
  });

  it("loads the NextClaw autostart builtin skill", () => {
    const workspace = createWorkspace();
    const loader = new SkillsLoader(workspace);

    const skill = loader.listSkills(false).find((entry) => entry.name === "nextclaw-autostart");

    expect(skill).toEqual(
      expect.objectContaining({
        name: "nextclaw-autostart",
        source: "builtin",
        scope: "builtin",
      }),
    );
    expect(loader.loadSkill("nextclaw-autostart")).toContain("nextclaw service autostart status");
  });

  it("documents Panel App Agent APIs in the builtin panel app creator skill", () => {
    const workspace = createWorkspace();
    const loader = new SkillsLoader(workspace);
    const skill = loader.loadSkill("panel-app-creator");

    expect(skill).toContain("window.nextclaw.agent.generateObject");
    expect(skill).toContain("window.nextclaw.agent.send");
    expect(skill).toContain("peerId");
    expect(skill).toContain("不要自己生成、缓存或猜测稳定 `sessionId`");
    expect(skill).toContain("窄侧栏优先布局");
    expect(skill).toContain("320px-480px");
    expect(skill).toContain("新建或重写 Panel App 时只使用目录式 Panel App");
    expect(skill).toContain("`panel-app.json` 是标题、描述、图标、入口、Agent capabilities 和 Service actions 的唯一 manifest 事实源");
    expect(skill).toContain("\"capabilities\": [\"agent:generateObject\", \"agent:send\"]");
    expect(skill).toContain("agent:generateObject");
    expect(skill).toContain("agent:send");
    expect(skill).toContain("\"actions\": [\"workspace-files.list\", \"workspace-files.read\"]");
    expect(skill).toContain("不要在 HTML `<head>` 中添加 NextClaw manifest meta");
  });

  it("loads the NextClaw app creator orchestration skill", () => {
    const workspace = createWorkspace();
    const loader = new SkillsLoader(workspace);
    const skill = loader.loadSkill("nextclaw-app-creator");

    expect(skill).toContain("Panel-only");
    expect(skill).toContain("Service-only");
    expect(skill).toContain("Panel + Service");
    expect(skill).toContain("panel-app-creator");
    expect(skill).toContain("service-app-creator");
    expect(skill).toContain("window.nextclaw.serviceActions.invoke()");
    expect(skill).toContain("window.nextclaw.agent.generateObject()");
    expect(skill).toContain("不要外部生成稳定 `sessionId`");
    expect(skill).toContain("创建目录式 Panel App");
    expect(skill).toContain("`panel-app.json` 是 Panel App 标题、入口、图标、Agent capabilities 和 Service action allowlist 的唯一事实源");
  });

  it("keeps builtin skill descriptions bilingual", () => {
    const workspace = createWorkspace();
    const loader = new SkillsLoader(workspace);
    const builtinSkills = loader.listSkills(false).filter((entry) => entry.source === "builtin");

    expect(builtinSkills.length).toBeGreaterThan(0);
    for (const skill of builtinSkills) {
      const metadata = loader.getSkillMetadata(skill) ?? {};
      expect(metadata.description?.trim(), skill.name).toBeTruthy();
      expect(
        (metadata.description_zh ?? metadata.descriptionZh)?.trim(),
        skill.name,
      ).toBeTruthy();
    }
  });

  it("does not let a workspace copy shadow a builtin skill with the same name", () => {
    const workspace = createWorkspace();
    const copiedDir = join(workspace, "skills", "nextclaw-self-manage");
    mkdirSync(copiedDir, { recursive: true });
    writeFileSync(
      join(copiedDir, "SKILL.md"),
      [
        "---",
        "name: nextclaw-self-manage",
        "description: stale workspace copy",
        "---",
        "",
        "Stale copy.",
      ].join("\n"),
    );

    const loader = new SkillsLoader(workspace);
    const matches = loader.listSkills(false).filter((entry) => entry.name === "nextclaw-self-manage");

    expect(matches).toHaveLength(1);
    expect(matches[0]).toEqual(
      expect.objectContaining({
        source: "builtin",
        scope: "builtin",
      }),
    );
    expect(matches[0]?.path.startsWith(workspace)).toBe(false);
  });

  it("keeps always-on builtin skills active", () => {
    const workspace = createWorkspace();
    const loader = new SkillsLoader(workspace);

    expect(loader.getAlwaysSkills()).toContainEqual(
      expect.stringContaining("builtin:"),
    );
    expect(loader.getAlwaysSkills()).toContainEqual(
      expect.stringContaining("nextclaw-self-manage"),
    );
  });
});
