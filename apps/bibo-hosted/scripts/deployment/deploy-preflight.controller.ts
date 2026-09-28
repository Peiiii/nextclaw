import { execFileSync } from "node:child_process";

const git = (...args: string[]) => execFileSync("git", args, { cwd: process.cwd(), encoding: "utf8" }).trim();

try {
  if (git("status", "--porcelain", "--untracked-files=all")) {
    throw new Error("Bibo deployment requires a clean checkout.");
  }
  const head = git("rev-parse", "HEAD");
  const remote = git("ls-remote", "--exit-code", "origin", "refs/heads/master").split("\t", 1)[0];
  if (head !== remote) {
    throw new Error(`Bibo deployment requires the current remote master: local ${head.slice(0, 12)}, remote ${remote.slice(0, 12)}.`);
  }
  process.stdout.write(`Bibo deploy preflight passed: ${head}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
