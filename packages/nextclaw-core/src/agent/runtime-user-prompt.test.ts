import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { SkillsLoader } from "./skills.js";
import { buildBootstrapAwareUserPrompt } from "./runtime-user-prompt.js";

const tempWorkspaces: string[] = [];

function createWorkspace(): string {
  const workspace = mkdtempSync(join(tmpdir(), "nextclaw-runtime-user-prompt-test-"));
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

describe("buildBootstrapAwareUserPrompt", () => {
  it("injects workspace bootstrap files before the user message", () => {
    const workspace = createWorkspace();
    writeFileSync(join(workspace, "IDENTITY.md"), "Identity rules.\n");
    writeFileSync(join(workspace, "SOUL.md"), "Warm, direct tone.\n");
    mkdirSync(join(workspace, "skills", "demo-skill"), { recursive: true });
    writeFileSync(
      join(workspace, "skills", "demo-skill", "SKILL.md"),
      [
        "---",
        "name: demo-skill",
        "description: Demo skill",
        "---",
        "",
        "Use the demo skill instructions.",
      ].join("\n"),
    );

    const prompt = buildBootstrapAwareUserPrompt({
      workspace,
      sessionKey: "session-1",
      skills: new SkillsLoader(workspace),
      skillNames: ["demo-skill"],
      userMessage: "hello",
    });

    expect(prompt).toContain("# Project Context");
    expect(prompt).toContain("## IDENTITY.md");
    expect(prompt).toContain("Identity rules.");
    expect(prompt).toContain("## SOUL.md");
    expect(prompt).toContain("Warm, direct tone.");
    expect(prompt).toContain("If SOUL.md is present");
    expect(prompt).toContain("<name>demo-skill</name>");
    expect(prompt).toContain("## User Message");
    expect(prompt).toContain("hello");
    expect(prompt).not.toContain("Use the demo skill instructions.");
  });

  it("keeps the original user message when no workspace bootstrap files exist", () => {
    const workspace = createWorkspace();
    const prompt = buildBootstrapAwareUserPrompt({
      workspace,
      sessionKey: "session-2",
      skills: new SkillsLoader(workspace),
      skillNames: [],
      userMessage: "plain message",
    });

    expect(prompt).toBe("plain message");
  });
});
