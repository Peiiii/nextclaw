import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { SkillsLoader } from "../skills-loader.js";
import {
  DEFAULT_RUNTIME_USER_PROMPT_BUILDER,
  buildBootstrapAwareUserPrompt,
} from "../../runtime-context/runtime-user-prompt.js";

const tempWorkspaces: string[] = [];

function createWorkspace(): string {
  const workspace = mkdtempSync(join(tmpdir(), "nextclaw-runtime-user-prompt-test-"));
  tempWorkspaces.push(workspace);
  return workspace;
}

function writeGitConfig(workspace: string, config: string): void {
  mkdirSync(join(workspace, ".git"), { recursive: true });
  writeFileSync(join(workspace, ".git", "config"), config);
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
  it("injects workspace context and bootstrap files before the user message", () => {
    const workspace = createWorkspace();
    writeFileSync(join(workspace, "IDENTITY.md"), "Identity rules.\n");
    writeFileSync(join(workspace, "SOUL.md"), "Warm, direct tone.\n");
    writeGitConfig(
      workspace,
      [
        '[remote "origin"]',
        "  url = ssh://git@ssh.github.com:443/Peiiii/nextclaw.git",
      ].join("\n"),
    );
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
      skillSelectors: ["demo-skill"],
      userMessage: "hello",
    });

    expect(prompt).toContain("# Project Context");
    expect(prompt).toContain(`Active project directory: ${workspace}`);
    expect(prompt).toContain(`Repository root: ${workspace}`);
    expect(prompt).toContain("Canonical repository: https://github.com/Peiiii/nextclaw");
    expect(prompt).toContain("Repository identity rule:");
    expect(prompt).toContain("## IDENTITY.md");
    expect(prompt).toContain("Identity rules.");
    expect(prompt).toContain("## SOUL.md");
    expect(prompt).toContain("Warm, direct tone.");
    expect(prompt).toContain("If SOUL.md is present");
    expect(prompt).toContain("Project bootstrap files loaded:");
    expect(prompt).toContain("<name>demo-skill</name>");
    expect(prompt).toContain("<ref>workspace:");
    expect(prompt).toContain("`$weather`");
    expect(prompt).toContain("## Skill Learning");
    expect(prompt).toContain("decide whether it means `no_skill_change`, `patch_existing_skill`, or `create_new_skill`");
    expect(prompt).toContain("## User Message");
    expect(prompt).toContain("hello");
    expect(prompt).not.toContain("Use the demo skill instructions.");
  });

  it("still exposes the current project directory when no bootstrap files exist", () => {
    const workspace = createWorkspace();
    const prompt = buildBootstrapAwareUserPrompt({
      workspace,
      sessionKey: "session-2",
      skills: new SkillsLoader(workspace),
      skillSelectors: [],
      userMessage: "plain message",
    });

    expect(prompt).toContain("# Project Context");
    expect(prompt).toContain(`Active project directory: ${workspace}`);
    expect(prompt).toContain("No bootstrap context files were found in the active project directory.");
    expect(prompt).toContain("plain message");
  });

  it("injects execution policy overlay for model-specific prompts", () => {
    const workspace = createWorkspace();
    const prompt = buildBootstrapAwareUserPrompt({
      workspace,
      sessionKey: "session-4",
      skills: new SkillsLoader(workspace),
      skillSelectors: [],
      userMessage: "inspect and fix it",
      model: "gpt-5.4",
    });

    expect(prompt).toContain("## Current Turn Execution");
    expect(prompt).toContain("Do not stop at promises");
    expect(prompt).toContain("Do not guess time, date, system state");
    expect(prompt).not.toContain("Batch independent reads when possible.");
  });

  it("keeps project and host workspace skills distinct when names collide", () => {
    const hostWorkspace = createWorkspace();
    const projectRoot = createWorkspace();
    writeFileSync(join(hostWorkspace, "IDENTITY.md"), "Host identity.\n");
    writeFileSync(join(projectRoot, "AGENTS.md"), "Project instructions.\n");

    const hostSkillDir = join(hostWorkspace, "skills", "shared-skill");
    mkdirSync(hostSkillDir, { recursive: true });
    writeFileSync(
      join(hostSkillDir, "SKILL.md"),
      [
        "---",
        "name: shared-skill",
        "description: Host shared skill",
        "---",
        "",
        "Host skill body.",
      ].join("\n"),
    );

    const projectSkillDir = join(projectRoot, ".agents", "skills", "shared-skill");
    mkdirSync(projectSkillDir, { recursive: true });
    writeFileSync(
      join(projectSkillDir, "SKILL.md"),
      [
        "---",
        "name: shared-skill",
        "description: Project shared skill",
        "---",
        "",
        "Project skill body.",
      ].join("\n"),
    );

    const projectSkillRef = `project:${projectSkillDir}`;
    const hostSkillRef = `workspace:${hostSkillDir}`;
    const runtimeContext = DEFAULT_RUNTIME_USER_PROMPT_BUILDER.buildSessionPromptContext({
      workspace: projectRoot,
      hostWorkspace,
      sessionKey: "session-3",
      metadata: {
        project_root: projectRoot,
        requested_skill_refs: [projectSkillRef, hostSkillRef],
      },
      userMessage: "hello",
    });

    expect(runtimeContext.projectContext.hostWorkspace).toBe(hostWorkspace);
    expect(runtimeContext.projectContext.projectRoot).toBe(projectRoot);
    expect(runtimeContext.requestedSkills.selectors).toEqual([projectSkillRef, hostSkillRef]);
    expect(runtimeContext.requestedSkills.eventMetadata).toEqual({
      requested_skill_refs: [projectSkillRef, hostSkillRef],
    });
    expect(
      runtimeContext.skills.listSkills().filter((skill) => skill.name === "shared-skill"),
    ).toEqual([
      expect.objectContaining({ ref: projectSkillRef, scope: "project" }),
      expect.objectContaining({ ref: hostSkillRef, scope: "workspace" }),
    ]);
    expect(runtimeContext.prompt).toContain("# Project Context");
    expect(runtimeContext.prompt).toContain("# Host Workspace Context");
    expect(runtimeContext.prompt).toContain(projectSkillRef);
    expect(runtimeContext.prompt).toContain(hostSkillRef);
  });
});
