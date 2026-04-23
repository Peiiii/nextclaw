#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const desktopDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workspaceRoot = resolve(desktopDir, "..", "..");
const runtimePackageRoot = resolve(desktopDir, "node_modules", "nextclaw");
const runtimeEntrypoint = resolve(
  desktopDir,
  "node_modules",
  "nextclaw",
  "dist",
  "cli",
  "app",
  "index.js"
);
const runtimeUiEntrypoint = resolve(desktopDir, "node_modules", "nextclaw", "ui-dist", "index.html");
const runtimeBinShim = resolve(desktopDir, "node_modules", "nextclaw", "bin", "nextclaw");

function ensureRuntimeBinShim() {
  if (existsSync(runtimeBinShim)) {
    return;
  }

  mkdirSync(resolve(runtimeBinShim, ".."), { recursive: true });
  writeFileSync(
    runtimeBinShim,
    ['#!/usr/bin/env node', 'import "../dist/cli/app/index.js";', ""].join("\n"),
    "utf8"
  );

  if (process.platform !== "win32") {
    spawnSync("chmod", ["+x", runtimeBinShim], { stdio: "ignore" });
  }
}

if (existsSync(runtimeEntrypoint) && existsSync(runtimeUiEntrypoint)) {
  ensureRuntimeBinShim();
  process.exit(0);
}

console.log("[desktop] nextclaw runtime missing, building packages/nextclaw-ui + packages/nextclaw...");

const uiBuildResult = spawnSync("pnpm", ["-C", "packages/nextclaw-ui", "build"], {
  cwd: workspaceRoot,
  env: process.env,
  stdio: "inherit",
  shell: process.platform === "win32"
});
if (uiBuildResult.status !== 0) {
  process.exit(uiBuildResult.status ?? 1);
}

const runtimeBuildResult = spawnSync("pnpm", ["-C", "packages/nextclaw", "build"], {
  cwd: workspaceRoot,
  env: process.env,
  stdio: "inherit",
  shell: process.platform === "win32"
});

if (runtimeBuildResult.status !== 0) {
  process.exit(runtimeBuildResult.status ?? 1);
}

if (!existsSync(runtimeEntrypoint)) {
  console.error("[desktop] build finished but runtime entrypoint is still missing:", runtimeEntrypoint);
  process.exit(1);
}

if (!existsSync(runtimeUiEntrypoint)) {
  console.error("[desktop] build finished but runtime UI entrypoint is still missing:", runtimeUiEntrypoint);
  process.exit(1);
}

if (!existsSync(runtimePackageRoot)) {
  console.error("[desktop] runtime package root missing:", runtimePackageRoot);
  process.exit(1);
}

ensureRuntimeBinShim();
