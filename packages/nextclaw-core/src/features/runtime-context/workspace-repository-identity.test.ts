import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  WorkspaceRepositoryIdentityResolver,
} from "./workspace-repository-identity.service.js";

const tempDirectories: string[] = [];

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirectories.push(dir);
  return dir;
}

function writeGitConfig(repoRoot: string, config: string): void {
  mkdirSync(join(repoRoot, ".git"), { recursive: true });
  writeFileSync(join(repoRoot, ".git", "config"), config);
}

afterEach(() => {
  while (tempDirectories.length > 0) {
    const dir = tempDirectories.pop();
    if (!dir) {
      continue;
    }
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("WorkspaceRepositoryIdentityResolver", () => {
  it("selects origin and normalizes GitHub SSH remotes into web URLs", () => {
    const repoRoot = createTempDir("nextclaw-repo-identity-");
    const workspace = join(repoRoot, "packages", "core");
    mkdirSync(workspace, { recursive: true });
    writeGitConfig(
      repoRoot,
      [
        '[remote "origin"]',
        "  url = ssh://git@ssh.github.com:443/Peiiii/nextclaw.git",
        '[remote "origin-https"]',
        "  url = https://github.com/Peiiii/nextclaw.git",
      ].join("\n"),
    );

    const resolver = new WorkspaceRepositoryIdentityResolver();
    const identity = resolver.resolve(workspace);

    expect(identity.repoRoot).toBe(repoRoot);
    expect(identity.canonicalRemoteName).toBe("origin");
    expect(identity.canonicalRemoteUrl).toBe("ssh://git@ssh.github.com:443/Peiiii/nextclaw.git");
    expect(identity.canonicalWebUrl).toBe("https://github.com/Peiiii/nextclaw");
  });

  it("reads linked gitdir config files used by git worktrees", () => {
    const repoRoot = createTempDir("nextclaw-repo-worktree-");
    const gitDir = createTempDir("nextclaw-repo-gitdir-");
    mkdirSync(join(repoRoot, ".git"), { recursive: true });
    rmSync(join(repoRoot, ".git"), { recursive: true, force: true });
    writeFileSync(join(repoRoot, ".git"), `gitdir: ${gitDir}\n`);
    writeFileSync(
      join(gitDir, "config"),
      [
        '[remote "origin"]',
        "  url = git@github.com:openclaw/openclaw.git",
      ].join("\n"),
    );

    const resolver = new WorkspaceRepositoryIdentityResolver();
    const identity = resolver.resolve(repoRoot);

    expect(identity.repoRoot).toBe(repoRoot);
    expect(identity.canonicalWebUrl).toBe("https://github.com/openclaw/openclaw");
  });

  it("returns an empty identity when the workspace is not inside a git repository", () => {
    const workspace = createTempDir("nextclaw-repo-none-");
    const resolver = new WorkspaceRepositoryIdentityResolver();
    const identity = resolver.resolve(workspace);

    expect(identity.repoRoot).toBeNull();
    expect(identity.canonicalRemoteName).toBeNull();
    expect(identity.canonicalRemoteUrl).toBeNull();
    expect(identity.canonicalWebUrl).toBeNull();
  });
});
