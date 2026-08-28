import { accessSync, chmodSync, constants, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  createNextclawDistribution,
  repairPackagedPortableRunnerPermissions,
} from "./nextclaw-distribution.utils.js";

describe("createNextclawDistribution", () => {
  it("derives package-owned distribution metadata from the package entrypoint", () => {
    const packageRoot = mkdtempSync(resolve(tmpdir(), "nextclaw-distribution-"));

    try {
      writeFileSync(resolve(packageRoot, "package.json"), JSON.stringify({ version: "0.19.4" }));

      const distribution = createNextclawDistribution(
        pathToFileURL(resolve(packageRoot, "dist/cli/app/index.js")).href
      );

      expect(distribution).toMatchObject({
        version: "0.19.4",
        appEntrypoint: resolve(packageRoot, "dist/cli/app/index.js"),
        launcherVersion: "0.19.4",
        launcherEntrypoint: resolve(packageRoot, "dist/cli/launcher/index.js"),
        launchedByLauncher: false,
        templatesDir: resolve(packageRoot, "templates"),
        uiDistDir: resolve(packageRoot, "ui-dist"),
        runtimeUpdatePublicKeyPath: resolve(packageRoot, "resources/update-bundle-public.pem"),
        builtInAppsDirectory: resolve(packageRoot, "resources/apps"),
        portableServiceRunnerPath: resolve(
          packageRoot,
          "resources/native",
          `${process.platform}-${process.arch}`,
          process.platform === "win32" ? "nextclaw-wasmtime-runner.exe" : "nextclaw-wasmtime-runner"
        )
      });
      expect(
        createNextclawDistribution(pathToFileURL(resolve(packageRoot, "src/cli/app/index.ts")).href)
      ).toMatchObject({
        launcherEntrypoint: resolve(packageRoot, "src/cli/launcher/index.ts")
      });
    } finally {
      rmSync(packageRoot, { force: true, recursive: true });
    }
  });

  it.runIf(process.platform !== "win32")("repairs only the packaged runner executable bit", () => {
    const packageRoot = mkdtempSync(resolve(tmpdir(), "nextclaw-distribution-runner-"));

    try {
      writeFileSync(resolve(packageRoot, "package.json"), JSON.stringify({ version: "0.45.1" }));
      const runnerPath = resolve(
        packageRoot,
        "resources/native",
        `${process.platform}-${process.arch}`,
        "nextclaw-wasmtime-runner",
      );
      mkdirSync(resolve(runnerPath, ".."), { recursive: true });
      writeFileSync(runnerPath, "runner");
      chmodSync(runnerPath, 0o644);
      const distribution = createNextclawDistribution(
        pathToFileURL(resolve(packageRoot, "dist/cli/app/index.js")).href,
      );
      const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

      expect(repairPackagedPortableRunnerPermissions(distribution)).toBe(true);
      expect(() => accessSync(runnerPath, constants.X_OK)).not.toThrow();
      expect(repairPackagedPortableRunnerPermissions(distribution)).toBe(false);
      expect(stderr).toHaveBeenCalledTimes(1);
    } finally {
      vi.restoreAllMocks();
      rmSync(packageRoot, { force: true, recursive: true });
    }
  });
});
