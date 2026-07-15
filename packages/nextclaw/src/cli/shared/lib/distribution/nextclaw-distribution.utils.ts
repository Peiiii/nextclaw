import { readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextclawDistribution } from "@nextclaw/service";

export function createNextclawDistribution(importMetaUrl: string): NextclawDistribution {
  const entrypoint = fileURLToPath(importMetaUrl);
  const packageRoot = resolve(dirname(entrypoint), "../../..");
  const { version } = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf-8")) as { version?: string };
  return {
    version: typeof version === "string" ? version : "0.0.0",
    appEntrypoint: resolve(packageRoot, "dist/cli/app/index.js"),
    launcherEntrypoint: resolve(dirname(entrypoint), "../launcher", basename(entrypoint)),
    uiDistDir: resolve(packageRoot, "ui-dist"),
    runtimeUpdatePublicKeyPath: resolve(packageRoot, "resources/update-bundle-public.pem")
  };
}
