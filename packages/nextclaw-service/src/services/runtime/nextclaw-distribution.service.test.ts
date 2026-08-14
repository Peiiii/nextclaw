import { describe, expect, it } from "vitest";
import type { NextclawDistribution } from "@nextclaw-service/types/distribution.types.js";
import { NextclawDistributionService } from "./nextclaw-distribution.service.js";

const PACKAGED_DISTRIBUTION: NextclawDistribution = {
  version: "0.35.0",
  appEntrypoint: "/runtime/0.35.0/dist/cli/app/index.js",
  launcherVersion: "0.35.0",
  launcherEntrypoint: "/runtime/0.35.0/dist/cli/launcher/index.js",
  launchedByLauncher: false,
  templatesDir: "/runtime/0.35.0/templates",
  uiDistDir: "/runtime/0.35.0/ui-dist",
  runtimeUpdatePublicKeyPath: "/runtime/0.35.0/resources/update-bundle-public.pem",
};

describe("NextclawDistributionService.configureRuntime", () => {
  it("consumes launcher metadata into the canonical distribution before business code runs", () => {
    const env: NodeJS.ProcessEnv = {
      PATH: "/usr/bin",
      NEXTCLAW_RUNTIME_BUNDLE_CHILD: "1",
      NEXTCLAW_DISABLE_RUNTIME_BUNDLE_LAUNCHER: "1",
      NEXTCLAW_NPM_LAUNCHER_VERSION: "0.34.0",
      NEXTCLAW_NPM_LAUNCHER_ENTRYPOINT: "/usr/lib/node_modules/nextclaw/dist/cli/launcher/index.js",
    };

    NextclawDistributionService.configureRuntime(PACKAGED_DISTRIBUTION, env);

    expect(NextclawDistributionService.get()).toMatchObject({
      version: "0.35.0",
      launcherVersion: "0.34.0",
      launcherEntrypoint: "/usr/lib/node_modules/nextclaw/dist/cli/launcher/index.js",
      launchedByLauncher: true,
    });
    expect(env).toEqual({ PATH: "/usr/bin" });
  });

  it("ignores stale launcher metadata without a launcher child marker and still removes it", () => {
    const env: NodeJS.ProcessEnv = {
      NEXTCLAW_NPM_LAUNCHER_VERSION: "0.1.0",
      NEXTCLAW_NPM_LAUNCHER_ENTRYPOINT: "/stale/launcher.js",
    };

    NextclawDistributionService.configureRuntime(PACKAGED_DISTRIBUTION, env);

    expect(NextclawDistributionService.get()).toMatchObject({
      version: "0.35.0",
      launcherVersion: "0.35.0",
      launcherEntrypoint: "/runtime/0.35.0/dist/cli/launcher/index.js",
      launchedByLauncher: false,
    });
    expect(env).toEqual({});
  });
});
