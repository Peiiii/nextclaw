import { readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextclawDistribution } from "@nextclaw/service";

export function createNextclawDistribution(importMetaUrl: string): NextclawDistribution {
  const entrypoint = fileURLToPath(importMetaUrl);
  const packageRoot = resolve(dirname(entrypoint), "../../..");
  const { version } = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf-8")) as { version?: string };
  const portableRunnerExecutable = process.platform === "win32"
    ? "nextclaw-wasmtime-runner.exe"
    : "nextclaw-wasmtime-runner";
  return {
    version: typeof version === "string" ? version : "0.0.0",
    appEntrypoint: resolve(packageRoot, "dist/cli/app/index.js"),
    launcherVersion: typeof version === "string" ? version : "0.0.0",
    launcherEntrypoint: resolve(dirname(entrypoint), "../launcher", basename(entrypoint)),
    launchedByLauncher: false,
    templatesDir: resolve(packageRoot, "templates"),
    uiDistDir: resolve(packageRoot, "ui-dist"),
    runtimeUpdatePublicKeyPath: resolve(packageRoot, "resources/update-bundle-public.pem"),
    builtInAppsDirectory: resolve(packageRoot, "resources/apps"),
    portableServiceRunnerPath: resolve(
      packageRoot,
      "resources/native",
      `${process.platform}-${process.arch}`,
      portableRunnerExecutable,
    )
  };
}
