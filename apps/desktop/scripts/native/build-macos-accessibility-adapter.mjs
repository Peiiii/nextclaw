#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const desktopRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const serviceRoot = resolve(fileURLToPath(new URL("../../../../packages/nextclaw-service", import.meta.url)));
const source = join(desktopRoot, "native", "macos-accessibility.node.mm");
const keyboardInputSource = join(serviceRoot, "src", "services", "desktop", "macos-keyboard-input.m");

export function buildMacosAccessibilityAdapter(options = {}) {
  const platform = options.platform?.trim() || process.platform;
  if (platform !== "darwin") return null;
  if (process.platform !== "darwin") {
    throw new Error("The macOS Accessibility adapter must be built on macOS.");
  }
  const arch = options.arch?.trim() || process.arch;
  const output = resolve(
    options.output?.trim()
      || join(desktopRoot, "build", "native-app-resources", "native", "macos-accessibility.node"),
  );
  const electronVersion = JSON.parse(
    readFileSync(join(desktopRoot, "node_modules", "electron", "package.json"), "utf8"),
  ).version;
  const headers = resolve(
    process.env.HOME || "",
    ".electron-gyp",
    electronVersion,
    "include",
    "node",
  );
  if (!existsSync(join(headers, "node_api.h"))) {
    throw new Error(`Electron headers are missing: ${headers}`);
  }
  const clangArch = arch === "x64" ? "x86_64" : arch;
  if (clangArch !== "arm64" && clangArch !== "x86_64") {
    throw new Error(`Unsupported macOS Accessibility adapter architecture: ${arch}`);
  }
  mkdirSync(dirname(output), { recursive: true });
  const result = spawnSync("xcrun", [
    "clang++",
    "-std=c++17",
    "-ObjC++",
    "-shared",
    "-undefined",
    "dynamic_lookup",
    "-fno-exceptions",
    "-fno-rtti",
    "-arch",
    clangArch,
    `-I${headers}`,
    "-framework",
    "ApplicationServices",
    "-framework",
    "AppKit",
    "-framework",
    "ScreenCaptureKit",
    "-framework",
    "Vision",
    source,
    "-o",
    output,
  ], { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`macOS Accessibility adapter build failed (${result.status ?? 1}).`);
  }
  return output;
}

export function buildMacosKeyboardInputHelper(options = {}) {
  const platform = options.platform?.trim() || process.platform;
  if (platform !== "darwin") return null;
  if (process.platform !== "darwin") throw new Error("The macOS keyboard helper must be built on macOS.");
  const arch = options.arch?.trim() || process.arch;
  const clangArch = arch === "x64" ? "x86_64" : arch;
  if (clangArch !== "arm64" && clangArch !== "x86_64") {
    throw new Error(`Unsupported macOS keyboard helper architecture: ${arch}`);
  }
  const output = resolve(
    options.output?.trim() || join(desktopRoot, "build", "native-app-resources", "native", "macos-keyboard-input"),
  );
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
    keyboardInputSource,
    "-o",
    output,
  ], { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`macOS keyboard helper build failed (${result.status ?? 1}).`);
  }
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  const output = buildMacosAccessibilityAdapter({ output: process.argv[2] });
  if (output) console.log(output);
}
