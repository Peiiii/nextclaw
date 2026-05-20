import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfigSchema, ENV_HOME_KEY } from "@nextclaw/core";
import {
  applyDevFirstPartyPluginLoadPaths,
  resolveDevFirstPartyPluginDir,
  resolveDevFirstPartyPluginInstallRoots,
  resolveDevFirstPartyPluginLoadPaths,
} from "./first-party-plugin-load-paths.utils.js";

const tempDirs: string[] = [];
const originalHomeDir = process.env[ENV_HOME_KEY];

const createTempDir = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "nextclaw-dev-plugin-load-paths-"));
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

describe("resolveDevFirstPartyPluginLoadPaths", () => {
  it("falls back to repo-local packages/extensions when running from source without env override", () => {
    const fakeModuleDir = path.join(
      createTempDir(),
      "packages",
      "nextclaw",
      "src",
      "cli",
      "commands",
      "plugin",
      "development-source",
    );
    const inferredExtensionsDir = path.resolve(fakeModuleDir, "../../../../../extensions");
    mkdirSync(inferredExtensionsDir, { recursive: true });

    expect(resolveDevFirstPartyPluginDir(undefined, fakeModuleDir)).toBe(inferredExtensionsDir);
  });

  it("maps installed first-party npm plugins to local workspace package dirs", () => {
    const workspaceExtensionsDir = createTempDir();
    writeWorkspacePluginPackage(
      workspaceExtensionsDir,
      "nextclaw-channel-plugin-slack",
      "@nextclaw/channel-plugin-slack",
    );
    writeWorkspacePluginPackage(
      workspaceExtensionsDir,
      "other-package",
      "@nextclaw/other-package",
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
            source: "npm",
            spec: "@nextclaw/channel-plugin-slack@0.1.0",
          },
        },
      },
    });

    expect(resolveDevFirstPartyPluginLoadPaths(config, workspaceExtensionsDir)).toEqual([
      path.join(workspaceExtensionsDir, "nextclaw-channel-plugin-slack"),
    ]);
  });

  it("maps globally installed first-party plugins to local workspace package dirs even without install records", () => {
    const nextclawHome = createTempNextclawHome();
    const workspaceExtensionsDir = createTempDir();
    const workspacePluginDir = path.join(
      workspaceExtensionsDir,
      "nextclaw-channel-plugin-slack",
    );
    writeWorkspacePluginPackage(
      workspaceExtensionsDir,
      "nextclaw-channel-plugin-slack",
      "@nextclaw/channel-plugin-slack",
      { withDevelopmentSource: true },
    );
    writeWorkspacePluginPackage(
      path.join(nextclawHome, "extensions"),
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
      plugins: {},
    });

    expect(resolveDevFirstPartyPluginLoadPaths(config, workspaceExtensionsDir)).toEqual([
      workspacePluginDir,
    ]);
    expect(resolveDevFirstPartyPluginInstallRoots(config, workspaceExtensionsDir)).toEqual([
      path.join(nextclawHome, "extensions", "nextclaw-channel-plugin-slack"),
    ]);

    const nextConfig = applyDevFirstPartyPluginLoadPaths(config, workspaceExtensionsDir);
    expect(nextConfig.plugins.load?.paths).toEqual([workspacePluginDir]);
  });

  it("prepends resolved dev plugin paths ahead of existing config load paths", () => {
    const workspaceExtensionsDir = createTempDir();
    writeWorkspacePluginPackage(
      workspaceExtensionsDir,
      "nextclaw-channel-plugin-slack",
      "@nextclaw/channel-plugin-slack",
    );
    const existingLoadPath = createTempDir();
    const config = ConfigSchema.parse({
      agents: {
        defaults: {
          workspace: createTempDir(),
          model: "openai/gpt-5",
        },
      },
      plugins: {
        load: {
          paths: [existingLoadPath],
        },
        installs: {
          "nextclaw-channel-plugin-slack": {
            source: "npm",
            spec: "@nextclaw/channel-plugin-slack",
          },
        },
      },
    });

    const nextConfig = applyDevFirstPartyPluginLoadPaths(config, workspaceExtensionsDir);
    expect(nextConfig.plugins.load?.paths).toEqual([
      path.join(workspaceExtensionsDir, "nextclaw-channel-plugin-slack"),
      existingLoadPath,
    ]);
  });

  it("keeps matched first-party plugins on production source unless explicitly overridden", () => {
    const workspaceExtensionsDir = createTempDir();
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
            source: "npm",
            spec: "@nextclaw/channel-plugin-slack",
          },
        },
      },
    });

    const nextConfig = applyDevFirstPartyPluginLoadPaths(config, workspaceExtensionsDir);
    expect(nextConfig.plugins.entries).toBeUndefined();
  });

  it("keeps explicit production source overrides instead of forcing development", () => {
    const workspaceExtensionsDir = createTempDir();
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
            source: "npm",
            spec: "@nextclaw/channel-plugin-slack",
          },
        },
        entries: {
          "nextclaw-channel-plugin-slack": {
            source: "production",
          },
        },
      },
    });

    const nextConfig = applyDevFirstPartyPluginLoadPaths(config, workspaceExtensionsDir);
    expect(nextConfig.plugins.entries?.["nextclaw-channel-plugin-slack"]).toEqual({
      source: "production",
    });
  });

  it("returns install roots for first-party npm plugins so dev can suppress duplicated installed copies", () => {
    const workspaceExtensionsDir = createTempDir();
    writeWorkspacePluginPackage(
      workspaceExtensionsDir,
      "nextclaw-channel-plugin-slack",
      "@nextclaw/channel-plugin-slack",
    );
    const installRoot = path.join(createTempDir(), "nextclaw-channel-plugin-slack");
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
            source: "npm",
            spec: "@nextclaw/channel-plugin-slack",
            installPath: installRoot,
          },
        },
      },
    });

    expect(resolveDevFirstPartyPluginInstallRoots(config, workspaceExtensionsDir)).toEqual([installRoot]);
  });

});
