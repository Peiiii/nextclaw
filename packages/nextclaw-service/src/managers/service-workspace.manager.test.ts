import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { ServiceWorkspaceManager } from "./service-workspace.manager.js";

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-workspace-test-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (!dir) {
      continue;
    }
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("ServiceWorkspaceManager", () => {
  it("creates the skills directory without seeding builtin skills into the workspace", () => {
    const workspace = createTempDir();
    const manager = new ServiceWorkspaceManager(join(workspace, "missing-templates"));

    manager.createWorkspaceTemplates(workspace);

    expect(existsSync(join(workspace, "skills"))).toBe(true);
    expect(existsSync(join(workspace, "USAGE.md"))).toBe(false);
    expect(existsSync(join(workspace, "skills", "nextclaw-self-manage", "SKILL.md"))).toBe(false);
  });

  it("copies templates from the configured distribution directory", () => {
    const workspace = createTempDir();
    const templatesDir = createTempDir();
    const templates = [
      "AGENTS.md",
      "SOUL.md",
      "USER.md",
      "IDENTITY.md",
      "TOOLS.md",
      "BOOT.md",
      "BOOTSTRAP.md",
      "MEMORY.md",
      "memory/MEMORY.md"
    ];
    for (const template of templates) {
      const templatePath = join(templatesDir, template);
      mkdirSync(dirname(templatePath), { recursive: true });
      writeFileSync(templatePath, "${APP_NAME} template");
    }

    const result = new ServiceWorkspaceManager(templatesDir).createWorkspaceTemplates(workspace);

    expect(result.created).toContain("AGENTS.md");
    expect(result.created).toContain("memory/MEMORY.md");
    expect(readFileSync(join(workspace, "AGENTS.md"), "utf-8")).toBe("nextclaw template");
  });
});
