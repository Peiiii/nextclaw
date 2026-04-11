import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigSchema } from "@nextclaw/core";
import {
  DEV_PLUGIN_OVERRIDES_ENV,
  resolveDevPluginLoadingContext,
  resolveDevPluginOverrides,
} from "./dev-plugin-overrides.utils.js";

const tempDirs: string[] = [];

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function createPluginDir({
  pluginId,
  packageName,
  withDevelopmentSource,
}: {
  pluginId: string;
  packageName: string;
  withDevelopmentSource?: boolean;
}): string {
  const rootDir = createTempDir("nextclaw-dev-plugin-override-");
  mkdirSync(path.join(rootDir, "dist"), { recursive: true });
  if (withDevelopmentSource) {
    mkdirSync(path.join(rootDir, "src"), { recursive: true });
  }
  writeFileSync(
    path.join(rootDir, "package.json"),
    JSON.stringify(
      {
        name: packageName,
        version: "0.0.0-test",
        openclaw: {
          extensions: ["dist/index.js"],
          ...(withDevelopmentSource
            ? {
                development: {
                  extensions: ["src/index.ts"],
                },
              }
            : {}),
        },
      },
      null,
      2,
    ),
  );
  writeFileSync(
    path.join(rootDir, "openclaw.plugin.json"),
    JSON.stringify(
      {
        id: pluginId,
        kind: "agent-runtime",
        name: pluginId,
        description: "test plugin",
        version: "0.0.0-test",
        configSchema: {
          type: "object",
          additionalProperties: true,
          properties: {},
        },
      },
      null,
      2,
    ),
  );
  writeFileSync(path.join(rootDir, "dist", "index.js"), "export default {};\n");
  if (withDevelopmentSource) {
    writeFileSync(path.join(rootDir, "src", "index.ts"), "export default {};\n");
  }
  return rootDir;
}

function createConfig({
  installPath,
  source,
}: {
  installPath?: string;
  source?: "production" | "development";
} = {}) {
  return ConfigSchema.parse({
    agents: {
      defaults: {
        workspace: createTempDir("nextclaw-dev-plugin-workspace-"),
        model: "openai/gpt-5.4",
      },
    },
    plugins: {
      installs: {
        "test-plugin": {
          source: "npm",
          spec: "@nextclaw/test-plugin",
          ...(installPath ? { installPath } : {}),
        },
      },
      ...(source
        ? {
            entries: {
              "test-plugin": {
                source,
              },
            },
          }
        : {}),
    },
  });
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  delete process.env[DEV_PLUGIN_OVERRIDES_ENV];
});

describe("resolveDevPluginOverrides", () => {
  it("parses multiple overrides from env json", () => {
    const pluginDir = createPluginDir({
      pluginId: "test-plugin",
      packageName: "@nextclaw/test-plugin",
      withDevelopmentSource: true,
    });
    const secondPluginDir = createPluginDir({
      pluginId: "test-plugin-2",
      packageName: "@nextclaw/test-plugin-2",
    });
    process.env[DEV_PLUGIN_OVERRIDES_ENV] = JSON.stringify([
      {
        pluginId: "test-plugin",
        pluginPath: pluginDir,
        source: "development",
      },
      {
        pluginId: "test-plugin-2",
        pluginPath: secondPluginDir,
      },
    ]);

    expect(resolveDevPluginOverrides()).toEqual([
      {
        pluginId: "test-plugin",
        pluginPath: pluginDir,
        source: "development",
      },
      {
        pluginId: "test-plugin-2",
        pluginPath: secondPluginDir,
        source: "production",
      },
    ]);
  });

  it("fails fast when override plugin id mismatches the local manifest", () => {
    const pluginDir = createPluginDir({
      pluginId: "actual-plugin",
      packageName: "@nextclaw/actual-plugin",
    });
    process.env[DEV_PLUGIN_OVERRIDES_ENV] = JSON.stringify([
      {
        pluginId: "expected-plugin",
        pluginPath: pluginDir,
      },
    ]);

    expect(() => resolveDevPluginOverrides()).toThrow(/plugin id mismatch/);
  });

  it("fails fast when development source is requested but missing", () => {
    const pluginDir = createPluginDir({
      pluginId: "test-plugin",
      packageName: "@nextclaw/test-plugin",
    });
    process.env[DEV_PLUGIN_OVERRIDES_ENV] = JSON.stringify([
      {
        pluginId: "test-plugin",
        pluginPath: pluginDir,
        source: "development",
      },
    ]);

    expect(() => resolveDevPluginOverrides()).toThrow(/openclaw\.development\.extensions/);
  });
});

describe("resolveDevPluginLoadingContext", () => {
  it("prepends explicit override paths and overrides entry source per plugin", () => {
    const pluginDir = createPluginDir({
      pluginId: "test-plugin",
      packageName: "@nextclaw/test-plugin",
      withDevelopmentSource: true,
    });
    const installPath = createTempDir("nextclaw-installed-plugin-");
    const config = createConfig({
      installPath,
      source: "production",
    });

    process.env[DEV_PLUGIN_OVERRIDES_ENV] = JSON.stringify([
      {
        pluginId: "test-plugin",
        pluginPath: pluginDir,
        source: "development",
      },
    ]);

    const { configWithDevPluginOverrides, excludedRoots } = resolveDevPluginLoadingContext(
      config,
      undefined,
    );

    expect(configWithDevPluginOverrides.plugins.load?.paths?.[0]).toBe(pluginDir);
    expect(configWithDevPluginOverrides.plugins.entries?.["test-plugin"]).toEqual({
      source: "development",
    });
    expect(excludedRoots).toContain(installPath);
  });
});
