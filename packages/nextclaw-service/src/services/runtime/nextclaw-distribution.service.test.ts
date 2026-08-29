import { describe, expect, it } from "vitest";
import type { Config } from "@nextclaw/core";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { NextclawDistribution } from "@nextclaw-service/types/distribution.types.js";
import { ProductActivityReporter } from "@nextclaw-service/services/product-activity/product-activity-reporter.service.js";
import { NextclawDistributionService } from "./nextclaw-distribution.service.js";

const PACKAGED_DISTRIBUTION: NextclawDistribution = {
  version: "0.35.0",
  productEnvironment: "development",
  releaseChannel: "development",
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
      productEnvironment: "production",
      releaseChannel: "stable",
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
      productEnvironment: "development",
      releaseChannel: "development",
    });
    expect(env).toEqual({});
  });

  it("uses explicit desktop release facts and infers prerelease channels", () => {
    const env: NodeJS.ProcessEnv = {
      NEXTCLAW_PRODUCT_ANALYTICS_ENVIRONMENT: "production",
    };

    NextclawDistributionService.configureRuntime({
      ...PACKAGED_DISTRIBUTION,
      version: "0.36.0-beta.2",
    }, env);

    expect(NextclawDistributionService.get()).toMatchObject({
      productEnvironment: "production",
      releaseChannel: "beta",
    });
  });

  it("keeps explicit test classification out of release metrics", () => {
    const env: NodeJS.ProcessEnv = {
      NEXTCLAW_PRODUCT_ANALYTICS_ENVIRONMENT: "test",
      NEXTCLAW_PRODUCT_ANALYTICS_RELEASE_CHANNEL: "nightly",
    };

    NextclawDistributionService.configureRuntime(PACKAGED_DISTRIBUTION, env);

    expect(NextclawDistributionService.get()).toMatchObject({
      productEnvironment: "test",
      releaseChannel: "nightly",
    });
  });

  it("carries launcher release facts into anonymous activity receipts", async () => {
    const homeDir = mkdtempSync(join(tmpdir(), "nextclaw-distribution-activity-"));
    const requests: Array<Record<string, unknown>> = [];
    try {
      NextclawDistributionService.configureRuntime(PACKAGED_DISTRIBUTION, {
        NEXTCLAW_RUNTIME_BUNDLE_CHILD: "1",
      });
      const distribution = NextclawDistributionService.get();
      const reporter = new ProductActivityReporter({
        homeDir,
        productVersion: distribution.version,
        environment: distribution.productEnvironment,
        releaseChannel: distribution.releaseChannel,
        loadConfig: () => ({
          productAnalytics: { schemaVersion: 2, enabled: true, audience: "external" },
          providers: { nextclaw: { apiBase: "https://ai-gateway-api.nextclaw.io/v1" } },
        } as unknown as Config),
        fetchImpl: async (_input, init) => {
          requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
          return new Response(null, { status: 202 });
        },
      });

      await reporter.record({
        kind: "intent_accepted",
        occurredAt: "2026-08-30T00:00:00.000Z",
        source: "direct",
      });

      expect(requests).toHaveLength(3);
      expect(requests.every((body) => (
        body.environment === "production" && body.releaseChannel === "stable"
      ))).toBe(true);
    } finally {
      rmSync(homeDir, { recursive: true, force: true });
    }
  });
});
