import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceManager } from "./workspace-manager.service.js";

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

describe("WorkspaceManager", () => {
  it("creates the skills directory without seeding builtin skills into the workspace", () => {
    const workspace = createTempDir();
    const manager = new WorkspaceManager("logo");

    manager.createWorkspaceTemplates(workspace);

    expect(existsSync(join(workspace, "skills"))).toBe(true);
    expect(existsSync(join(workspace, "USAGE.md"))).toBe(false);
    expect(existsSync(join(workspace, "skills", "nextclaw-self-manage", "SKILL.md"))).toBe(false);
  });
});
