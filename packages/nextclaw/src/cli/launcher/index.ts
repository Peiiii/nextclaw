#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runNextclawNpmRuntimeLauncher } from "@nextclaw/service";
import { readNextclawPackageVersion } from "@/cli/shared/lib/package-version/index.js";

runNextclawNpmRuntimeLauncher(process.argv, {
  launcherVersion: readNextclawPackageVersion(import.meta.url),
  packagedAppEntrypoint: resolve(dirname(fileURLToPath(import.meta.url)), "../app/index.js"),
});
