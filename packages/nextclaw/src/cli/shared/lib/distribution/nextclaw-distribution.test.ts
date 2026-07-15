import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { createNextclawDistribution } from "./nextclaw-distribution.utils.js";

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
        launcherEntrypoint: resolve(packageRoot, "dist/cli/launcher/index.js"),
        uiDistDir: resolve(packageRoot, "ui-dist"),
        runtimeUpdatePublicKeyPath: resolve(packageRoot, "resources/update-bundle-public.pem")
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
});
