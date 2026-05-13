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
        packageRoot,
        appEntrypoint: resolve(packageRoot, "dist/cli/app/index.js"),
        uiDistDir: resolve(packageRoot, "ui-dist"),
        runtimeUpdatePublicKeyPath: resolve(packageRoot, "resources/update-bundle-public.pem")
      });
    } finally {
      rmSync(packageRoot, { force: true, recursive: true });
    }
  });
});
