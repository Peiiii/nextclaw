#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_BASE = "master";

export function assertProjectNodeVersion(root, currentVersion = process.versions.node) {
  const requiredVersion = readFileSync(join(root, ".nvmrc"), "utf8").trim();
  if (!requiredVersion) throw new Error(".nvmrc must declare the project Node version.");
  if (currentVersion !== requiredVersion) {
    throw new Error(
      `Worktree setup requires Node ${requiredVersion}; current Node is ${currentVersion}. ` +
      "Run it through pnpm dev:worktree so the project Node wrapper can select the exact version.",
    );
  }
  return requiredVersion;
}

export function parseParallelWorktreeArgs(args) {
  const options = { base: DEFAULT_BASE, bootstrap: true };
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--") continue;
    if (value === "--name") options.name = args[++index];
    else if (value === "--base") options.base = args[++index];
    else if (value === "--path") options.path = args[++index];
    else if (value === "--no-bootstrap") options.bootstrap = false;
    else if (value === "--help") options.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (!options.help && !options.name?.trim()) {
    throw new Error("--name <slug> is required.");
  }
  if (options.name && !/^[a-z0-9][a-z0-9-]*$/.test(options.name)) {
    throw new Error("--name must be a lowercase kebab-case slug.");
  }
  return options;
}

export function createParallelWorktreePlan({ base, name, path, root }) {
  const targetPath = resolve(path ?? join(dirname(root), `${basename(root)}-${name}`));
  return {
    base,
    branch: `codex/${name}`,
    root,
    targetPath,
    bootstrap: ["install", "--frozen-lockfile", "--offline", "--ignore-scripts"],
  };
}

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: "inherit" });
}

function getRoot(cwd) {
  return execFileSync("git", ["rev-parse", "--show-toplevel"], {
    cwd,
    encoding: "utf8",
  }).trim();
}

function printHelp() {
  process.stdout.write(`Create an isolated, cache-backed parallel development worktree.\n\n`);
  process.stdout.write(`Usage: pnpm dev:worktree -- --name <kebab-slug> [--base <ref>] [--path <dir>] [--no-bootstrap]\n`);
  process.stdout.write(`Bootstrap links dependencies from the shared pnpm store offline; it never shares another worktree's node_modules.\n`);
}

export function main({ argv = process.argv.slice(2), cwd = process.cwd() } = {}) {
  const options = parseParallelWorktreeArgs(argv);
  if (options.help) return printHelp();
  const root = getRoot(cwd);
  const nodeVersion = assertProjectNodeVersion(root);
  const plan = createParallelWorktreePlan({ ...options, root });
  run("git", ["worktree", "add", "-b", plan.branch, plan.targetPath, plan.base], root);
  if (options.bootstrap) run("corepack", ["pnpm", ...plan.bootstrap], plan.targetPath);
  process.stdout.write(`${JSON.stringify({
    schema: "nextclaw.parallel-worktree/v1",
    branch: plan.branch,
    path: plan.targetPath,
    base: plan.base,
    dependencyMode: options.bootstrap ? "offline-link-only" : "skipped",
    nodeVersion,
    next: "Build only the workspace dependency closure required by the planned validation.",
  })}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
