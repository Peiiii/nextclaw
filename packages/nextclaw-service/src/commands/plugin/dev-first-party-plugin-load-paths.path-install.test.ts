import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfigSchema, ENV_HOME_KEY } from "@nextclaw/core";
import {
  applyDevFirstPartyPluginLoadPaths,
  resolveDevFirstPartyPluginInstallRoots,
} from "./development-source/first-party-plugin-load-paths.utils.js";

const tempDirs: string[] = [];
const originalHomeDir = process.env[ENV_HOME_KEY];

const createTempDir = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "nextclaw-dev-plugin-path-install-"));
  tempDirs.push(dir);
  return dir;
};

const createTempNextclawHome = () => {
  const dir = createTempDir();
  process.env[ENV_HOME_KEY] = dir;
  return dir;
};

const writeWorkspacePluginPackage = (
  rootDir: string,
  dirName: string,
  packageName: string,
  options: {
    withDevelopmentSource?: boolean;
  } = {},
) => {
  const packageDir = path.join(rootDir, dirName);
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(
    path.join(packageDir, "package.json"),
    JSON.stringify({
      name: packageName,
      version: "0.0.0-test",
      openclaw: {
        extensions: ["dist/index.js"],
        ...(options.withDevelopmentSource
          ? {
              development: {
                extensions: ["src/index.ts"],
              },
            }
          : {}),
      },
    }),
  );
};

afterEach(() => {
  if (originalHomeDir) {
    process.env[ENV_HOME_KEY] = originalHomeDir;
  } else {
    delete process.env[ENV_HOME_KEY];
  }
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

beforeEach(() => {
  createTempNextclawHome();
});

describe("path-installed first-party plugin load paths", () => {
  it("keeps path-installed first-party plugins on production source when installPath matches the workspace package", () => {
    const workspaceExtensionsDir = createTempDir();
    const pluginDir = path.join(
      workspaceExtensionsDir,
      "nextclaw-channel-plugin-slack",
    );
    writeWorkspacePluginPackage(
      workspaceExtensionsDir,
      "nextclaw-channel-plugin-slack",
      "@nextclaw/channel-plugin-slack",
      { withDevelopmentSource: true },
    );
    const config = ConfigSchema.parse({
      agents: {
        defaults: {
          workspace: createTempDir(),
          model: "openai/gpt-5",
        },
      },
      plugins: {
        installs: {
          "nextclaw-channel-plugin-slack": {
            source: "path",
            sourcePath: pluginDir,
            installPath: pluginDir,
          },
        },
      },
    });

    const nextConfig = applyDevFirstPartyPluginLoadPaths(config, workspaceExtensionsDir);
    expect(nextConfig.plugins.entries).toBeUndefined();
    expect(nextConfig.plugins.load?.paths).toEqual([pluginDir]);
  });

  it("does not exclude path-installed first-party plugins when installPath is already the workspace package directory", () => {
    const workspaceExtensionsDir = createTempDir();
    const pluginDir = path.join(
      workspaceExtensionsDir,
      "nextclaw-channel-plugin-slack",
    );
    writeWorkspacePluginPackage(
      workspaceExtensionsDir,
      "nextclaw-channel-plugin-slack",
      "@nextclaw/channel-plugin-slack",
    );
    const config = ConfigSchema.parse({
      agents: {
        defaults: {
          workspace: createTempDir(),
          model: "openai/gpt-5",
        },
      },
      plugins: {
        installs: {
          "nextclaw-channel-plugin-slack": {
            source: "path",
            sourcePath: pluginDir,
            installPath: pluginDir,
          },
        },
      },
    });

    expect(resolveDevFirstPartyPluginInstallRoots(config, workspaceExtensionsDir)).toEqual([]);
  });
});
