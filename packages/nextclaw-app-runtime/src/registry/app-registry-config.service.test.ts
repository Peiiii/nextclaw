import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AppHomeService } from "../paths/app-home.service.js";
import { DEFAULT_APP_REGISTRY_URL } from "./app-remote-registry.types.js";
import { AppRegistryConfigService } from "./app-registry-config.service.js";

describe("AppRegistryConfigService", () => {
  const cleanupPaths: string[] = [];

  afterEach(async () => {
    delete process.env.NEXTCLAW_APP_REGISTRY;
    await Promise.all(
      cleanupPaths.map((entryPath) =>
        rm(entryPath, {
          recursive: true,
          force: true,
        }),
      ),
    );
    cleanupPaths.length = 0;
  });

  it("reads default, set, and reset registry configuration", async () => {
    const appHomeDirectory = path.join(
      tmpdir(),
      `napp-config-home-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    cleanupPaths.push(appHomeDirectory);
    const appHomeService = new AppHomeService(appHomeDirectory);
    const configService = new AppRegistryConfigService(appHomeService);

    await expect(configService.getSnapshot()).resolves.toEqual({
      defaultUrl: DEFAULT_APP_REGISTRY_URL,
      currentUrl: DEFAULT_APP_REGISTRY_URL,
      source: "default",
    });
    await expect(configService.setRegistryUrl("https://registry.example.com/private")).resolves.toEqual(
      {
        defaultUrl: DEFAULT_APP_REGISTRY_URL,
        currentUrl: "https://registry.example.com/private/",
        source: "config",
      },
    );
    await expect(configService.resetRegistryUrl()).resolves.toEqual({
      defaultUrl: DEFAULT_APP_REGISTRY_URL,
      currentUrl: DEFAULT_APP_REGISTRY_URL,
      source: "default",
    });
  });
});
