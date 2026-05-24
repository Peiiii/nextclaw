import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function run(cwd, command, args, options = {}) {
  const output = execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    env: options.env ?? process.env,
    stdio: options.capture === false ? "inherit" : ["ignore", "pipe", "pipe"]
  });
  return typeof output === "string" ? output.trim() : "";
}

export function createReleaseWorktree(repoRoot, target) {
  const tempRoot = mkdtempSync(join(tmpdir(), "nextclaw-desktop-release-"));
  const workspacePath = join(tempRoot, "repo");
  run(repoRoot, "git", ["worktree", "add", "--detach", workspacePath, target], { capture: false });
  return {
    path: workspacePath,
    dispose: () => {
      try {
        run(repoRoot, "git", ["worktree", "remove", "--force", workspacePath]);
      } finally {
        rmSync(tempRoot, { recursive: true, force: true });
      }
    }
  };
}

export function installReleaseWorktreeDependencies(workspacePath) {
  run(workspacePath, "pnpm", ["install", "--frozen-lockfile"], { capture: false });
}

export function runReleaseWorktreePackageVerify(workspacePath) {
  run(workspacePath, "pnpm", ["desktop:package:verify"], {
    capture: false,
    env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH ?? ""}` }
  });
}
