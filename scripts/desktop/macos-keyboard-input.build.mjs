#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const serviceRoot = join(repositoryRoot, "packages", "nextclaw-service");
const source = join(serviceRoot, "src", "services", "desktop", "macos-keyboard-input.m");
const output = join(serviceRoot, "build", "native", "macos-keyboard-input");

if (process.platform === "darwin") {
  const clangArch = process.arch === "x64" ? "x86_64" : process.arch;
  if (clangArch !== "arm64" && clangArch !== "x86_64") throw new Error(`Unsupported macOS keyboard helper architecture: ${process.arch}`);
  mkdirSync(dirname(output), { recursive: true });
  const result = spawnSync("xcrun", [
    "clang",
    "-fobjc-arc",
    "-arch",
    clangArch,
    "-framework",
    "ApplicationServices",
    "-framework",
    "AppKit",
    source,
    "-o",
    output,
  ], { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`macOS keyboard helper build failed (${result.status ?? 1}).`);
  console.log(output);
}
