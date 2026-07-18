import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SkillsLoader } from "@core/features/agent/services/skills-loader.service.js";

const tempWorkspaces: string[] = [];

afterEach(() => {
  while (tempWorkspaces.length > 0) {
    rmSync(tempWorkspaces.pop()!, { recursive: true, force: true });
  }
});

describe("Agent Browser builtin skill", () => {
  it("owns onboarding even when a stale workspace copy exists", () => {
    const workspace = mkdtempSync(join(tmpdir(), "nextclaw-agent-browser-skill-test-"));
    tempWorkspaces.push(workspace);
    const copiedDir = join(workspace, "skills", "agent-browser");
    mkdirSync(copiedDir, { recursive: true });
    writeFileSync(
      join(copiedDir, "SKILL.md"),
      [
        "---",
        "name: agent-browser",
        "description: stale marketplace copy",
        "---",
        "",
        "Stale copy.",
      ].join("\n"),
    );

    const loader = new SkillsLoader(workspace);
    const matches = loader.listSkills(false).filter((entry) => entry.name === "agent-browser");
    const content = loader.loadSkill("agent-browser");

    expect(matches).toHaveLength(1);
    expect(matches[0]).toEqual(
      expect.objectContaining({
        source: "builtin",
        scope: "builtin",
      }),
    );
    expect(content).toContain("command -v agent-browser");
    expect(content).toContain("npm install -g agent-browser");
    expect(content).toContain("agent-browser skills get core");
    expect(content).toContain("两者是独立能力");
    expect(content).toContain("专指外部 `agent-browser` CLI");
    expect(content).toContain("不要默认使用 `close --all`");
  });
});
