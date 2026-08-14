import { beforeEach, describe, expect, it, vi } from "vitest";
import { NpmRuntimeUpdateCommandService } from "./npm-runtime-update-command.service.js";
import { NextclawDistributionService } from "@nextclaw-service/services/runtime/nextclaw-distribution.service.js";

const mocks = vi.hoisted(() => ({
  managerOptions: [] as Array<Record<string, unknown>>,
}));

vi.mock("@nextclaw-service/services/runtime/npm-runtime-update-source.service.js", () => ({
  NpmRuntimeUpdateSourceService: class {
    resolveChannel = () => "stable";
    resolveManifestUrl = () => "https://example.invalid/manifest.json";
    resolveBundlePublicKey = () => "test-public-key";
  },
}));

vi.mock("@nextclaw-service/stores/npm-runtime-bundle-layout.store.js", () => ({
  NpmRuntimeBundleLayoutStore: class {
    getStatePath = () => "/tmp/nextclaw-runtime-state.json";
  },
}));

vi.mock("@nextclaw-service/stores/npm-runtime-update-state.store.js", () => ({
  NpmRuntimeUpdateStateStore: class {},
}));

vi.mock("@nextclaw-service/services/runtime/npm-runtime-bundle.service.js", () => ({
  NpmRuntimeBundleService: class {},
}));

vi.mock("@nextclaw-service/services/runtime/npm-runtime-update.service.js", () => ({
  NpmRuntimeUpdateService: class {},
}));

vi.mock("@nextclaw-service/managers/runtime-update.manager.js", () => ({
  RuntimeUpdateManager: class {
    constructor(options: Record<string, unknown>) {
      mocks.managerOptions.push(options);
    }

    run = async () => ({ status: "up-to-date" });
  },
}));

describe("NpmRuntimeUpdateCommandService", () => {
  beforeEach(() => {
    mocks.managerOptions.length = 0;
  });

  it("blocks npm runtime updates from the desktop command surface", async () => {
    NextclawDistributionService.configure({
      version: "0.19.26",
      appEntrypoint: "/runtime/dist/cli/app/index.js",
      launcherVersion: "0.19.26",
      launcherEntrypoint: "/runtime/dist/cli/launcher/index.js",
      launchedByLauncher: false,
      templatesDir: "/runtime/templates",
      uiDistDir: "/runtime/ui-dist",
      runtimeUpdatePublicKeyPath: "/runtime/resources/update-bundle-public.pem"
    });

    const snapshot = await new NpmRuntimeUpdateCommandService({
      NEXTCLAW_DESKTOP_COMMAND_SURFACE: "1"
    }).runManaged({ check: true, json: true });

    expect(snapshot).toMatchObject({
      status: "blocked",
      installationKind: "desktop-bundle",
      currentVersion: "0.19.26",
      blockReason: "unsupported-installation",
      canApplyInApp: false
    });
  });

  it("uses the canonical launcher version instead of the running bundle version", async () => {
    NextclawDistributionService.configure({
      version: "0.35.0",
      appEntrypoint: "/runtime/0.35.0/dist/cli/app/index.js",
      launcherVersion: "0.34.0",
      launcherEntrypoint: "/usr/lib/node_modules/nextclaw/dist/cli/launcher/index.js",
      launchedByLauncher: true,
      templatesDir: "/runtime/0.35.0/templates",
      uiDistDir: "/runtime/0.35.0/ui-dist",
      runtimeUpdatePublicKeyPath: "/runtime/0.35.0/resources/update-bundle-public.pem",
    });

    await new NpmRuntimeUpdateCommandService({}).runManaged({ check: true });

    expect(mocks.managerOptions).toHaveLength(1);
    expect(mocks.managerOptions[0]).toMatchObject({
      launcherVersion: "0.34.0",
    });
  });
});
