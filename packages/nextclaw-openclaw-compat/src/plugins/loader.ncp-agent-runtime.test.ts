import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigSchema } from "@nextclaw/core";
import { buildPluginLoaderAliases, loadOpenClawPlugins } from "./loader.js";

const tempDirs: string[] = [];

function createTempPluginDir(): string {
  const rootDir = mkdtempSync(join(tmpdir(), "nextclaw-plugin-ncp-runtime-"));
  tempDirs.push(rootDir);
  mkdirSync(join(rootDir, "dist"), { recursive: true });
  writeFileSync(
    join(rootDir, "package.json"),
    JSON.stringify(
      {
        name: "@test/ncp-runtime-plugin",
        version: "0.0.1",
        type: "module",
        openclaw: {
          extensions: ["dist/index.js"],
        },
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(rootDir, "openclaw.plugin.json"),
    JSON.stringify(
      {
        id: "test-ncp-runtime-plugin",
        kind: "agent-runtime",
        name: "Test NCP Runtime Plugin",
        description: "Registers a test runtime.",
        version: "0.0.1",
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
  writeRuntimePluginModule(rootDir, "Test Runtime");
  return rootDir;
}

function writeRuntimePluginModule(rootDir: string, label: string): void {
  writeFileSync(
    join(rootDir, "dist", "index.js"),
    [
      "const plugin = {",
      "  id: 'test-ncp-runtime-plugin',",
      "  name: 'Test NCP Runtime Plugin',",
      "  description: 'Registers a test runtime.',",
      "  configSchema: { type: 'object', additionalProperties: true, properties: {} },",
      "  register(api) {",
      "    api.registerNcpAgentRuntime({",
      "      kind: 'test-runtime',",
      `      label: '${label}',`,
      "      createRuntime() {",
      "        return { async *run() {} };",
      "      }",
      "    });",
      "  }",
      "};",
      "export default plugin;",
    ].join("\n"),
  );
}

function createAliasDependentPluginDir(): string {
  const rootDir = mkdtempSync(join(tmpdir(), "nextclaw-plugin-alias-"));
  tempDirs.push(rootDir);
  mkdirSync(join(rootDir, "dist"), { recursive: true });
  mkdirSync(join(rootDir, "node_modules", "@nextclaw", "ncp"), { recursive: true });
  writeFileSync(
    join(rootDir, "package.json"),
    JSON.stringify(
      {
        name: "@test/alias-dependent-plugin",
        version: "0.0.1",
        type: "module",
        openclaw: {
          extensions: ["dist/index.js"],
        },
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(rootDir, "openclaw.plugin.json"),
    JSON.stringify(
      {
        id: "test-alias-dependent-plugin",
        kind: "agent-runtime",
        name: "Alias Dependent Plugin",
        description: "Loads host @nextclaw packages through the plugin loader alias map.",
        version: "0.0.1",
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
  writeFileSync(
    join(rootDir, "node_modules", "@nextclaw", "ncp", "package.json"),
    JSON.stringify(
      {
        name: "@nextclaw/ncp",
        version: "0.0.0-test",
        type: "module",
        exports: {
          ".": {
            default: "./dist/index.js",
          },
        },
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(rootDir, "dist", "index.js"),
    [
      "import { NcpEventType } from '@nextclaw/ncp';",
      "const plugin = {",
      "  id: 'test-alias-dependent-plugin',",
      "  name: 'Alias Dependent Plugin',",
      "  description: 'Loads host @nextclaw packages through the plugin loader alias map.',",
      "  configSchema: { type: 'object', additionalProperties: true, properties: {} },",
      "  register(api) {",
      "    if (!NcpEventType) {",
      "      throw new Error('missing host alias for @nextclaw/ncp');",
      "    }",
      "    api.registerNcpAgentRuntime({",
      "      kind: 'alias-runtime',",
      "      label: 'Alias Runtime',",
      "      createRuntime() {",
      "        return { async *run() {} };",
      "      }",
      "    });",
      "  }",
      "};",
      "export default plugin;",
    ].join("\n"),
  );
  return rootDir;
}

function createLocalDependencyPluginDir(): string {
  const rootDir = mkdtempSync(join(tmpdir(), "nextclaw-plugin-local-dependency-"));
  tempDirs.push(rootDir);
  mkdirSync(join(rootDir, "dist"), { recursive: true });
  mkdirSync(join(rootDir, "node_modules", "@nextclaw", "ncp", "dist"), { recursive: true });
  writeFileSync(
    join(rootDir, "package.json"),
    JSON.stringify(
      {
        name: "@test/local-dependency-plugin",
        version: "0.0.1",
        type: "module",
        openclaw: {
          extensions: ["dist/index.js"],
        },
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(rootDir, "openclaw.plugin.json"),
    JSON.stringify(
      {
        id: "test-local-dependency-plugin",
        kind: "agent-runtime",
        name: "Local Dependency Plugin",
        description: "Uses plugin-local @nextclaw dependencies when they are runnable.",
        version: "0.0.1",
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
  writeFileSync(
    join(rootDir, "node_modules", "@nextclaw", "ncp", "package.json"),
    JSON.stringify(
      {
        name: "@nextclaw/ncp",
        version: "0.0.0-local",
        type: "module",
        exports: "./dist/index.js",
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(rootDir, "node_modules", "@nextclaw", "ncp", "dist", "index.js"),
    "export const LOCAL_MARKER = 'plugin-local';\n",
  );
  writeFileSync(
    join(rootDir, "dist", "index.js"),
    [
      "import { LOCAL_MARKER } from '@nextclaw/ncp';",
      "const plugin = {",
      "  id: 'test-local-dependency-plugin',",
      "  name: 'Local Dependency Plugin',",
      "  description: 'Uses plugin-local @nextclaw dependencies when they are runnable.',",
      "  configSchema: { type: 'object', additionalProperties: true, properties: {} },",
      "  register(api) {",
      "    if (LOCAL_MARKER !== 'plugin-local') {",
      "      throw new Error('expected plugin-local dependency');",
      "    }",
      "    api.registerNcpAgentRuntime({",
      "      kind: 'local-dependency-runtime',",
      "      label: 'Local Dependency Runtime',",
      "      createRuntime() {",
      "        return { async *run() {} };",
      "      }",
      "    });",
      "  }",
      "};",
      "export default plugin;",
    ].join("\n"),
  );
  return rootDir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("loadOpenClawPlugins ncp agent runtime registration", () => {
  it("prefers runnable plugin-local @nextclaw packages over host aliases", () => {
    const pluginDir = createLocalDependencyPluginDir();
    const config = ConfigSchema.parse({
      plugins: {
        allow: ["test-local-dependency-plugin"],
        load: {
          paths: [pluginDir],
        },
        entries: {
          "test-local-dependency-plugin": {
            enabled: true,
          },
        },
      },
    });

    const registry = loadOpenClawPlugins({
      config,
      reservedNcpAgentRuntimeKinds: ["native"],
    });

    expect(registry.ncpAgentRuntimes).toHaveLength(1);
    expect(registry.ncpAgentRuntimes[0]).toMatchObject({
      pluginId: "test-local-dependency-plugin",
      kind: "local-dependency-runtime",
      label: "Local Dependency Runtime",
    });
  });

  it("aliases host @nextclaw packages when external plugin-local copies are not runnable", () => {
    const pluginDir = createAliasDependentPluginDir();
    const config = ConfigSchema.parse({
      plugins: {
        allow: ["test-alias-dependent-plugin"],
        load: {
          paths: [pluginDir],
        },
        entries: {
          "test-alias-dependent-plugin": {
            enabled: true,
          },
        },
      },
    });

    const registry = loadOpenClawPlugins({
      config,
      reservedNcpAgentRuntimeKinds: ["native"],
    });

    expect(buildPluginLoaderAliases()).toHaveProperty("@nextclaw/ncp");
    expect(registry.ncpAgentRuntimes).toHaveLength(1);
    expect(registry.ncpAgentRuntimes[0]).toMatchObject({
      pluginId: "test-alias-dependent-plugin",
      kind: "alias-runtime",
      label: "Alias Runtime",
    });
  });

  it("loads plugin-provided ncp agent runtimes into the registry", () => {
    const pluginDir = createTempPluginDir();
    const config = ConfigSchema.parse({
      plugins: {
        allow: ["test-ncp-runtime-plugin"],
        load: {
          paths: [pluginDir],
        },
        entries: {
          "test-ncp-runtime-plugin": {
            enabled: true,
          },
        },
      },
    });

    const registry = loadOpenClawPlugins({
      config,
      reservedNcpAgentRuntimeKinds: ["native"],
    });

    expect(registry.ncpAgentRuntimes).toHaveLength(1);
    expect(registry.ncpAgentRuntimes[0]).toMatchObject({
      pluginId: "test-ncp-runtime-plugin",
      kind: "test-runtime",
      label: "Test Runtime",
    });

    const plugin = registry.plugins.find((entry) => entry.id === "test-ncp-runtime-plugin");
    expect(plugin?.ncpAgentRuntimeKinds).toEqual(["test-runtime"]);
  });

  it("discovers installed runtime plugins from plugins.installs.installPath without extra load paths", () => {
    const pluginDir = createTempPluginDir();
    const config = ConfigSchema.parse({
      plugins: {
        allow: ["test-ncp-runtime-plugin"],
        installs: {
          "test-ncp-runtime-plugin": {
            source: "npm",
            spec: "@test/ncp-runtime-plugin",
            installPath: pluginDir,
          },
        },
        entries: {
          "test-ncp-runtime-plugin": {
            enabled: true,
          },
        },
      },
    });

    const registry = loadOpenClawPlugins({
      config,
      reservedNcpAgentRuntimeKinds: ["native"],
    });

    expect(registry.ncpAgentRuntimes).toHaveLength(1);
    expect(registry.ncpAgentRuntimes[0]).toMatchObject({
      pluginId: "test-ncp-runtime-plugin",
      kind: "test-runtime",
      label: "Test Runtime",
    });
  });

  it("reloads updated runtime plugin code from the same path without reusing stale module cache", () => {
    const pluginDir = createTempPluginDir();
    const config = ConfigSchema.parse({
      plugins: {
        allow: ["test-ncp-runtime-plugin"],
        load: {
          paths: [pluginDir],
        },
        entries: {
          "test-ncp-runtime-plugin": {
            enabled: true,
          },
        },
      },
    });

    const initialRegistry = loadOpenClawPlugins({
      config,
      reservedNcpAgentRuntimeKinds: ["native"],
    });
    expect(initialRegistry.ncpAgentRuntimes[0]?.label).toBe("Test Runtime");

    writeRuntimePluginModule(pluginDir, "Test Runtime v2");

    const reloadedRegistry = loadOpenClawPlugins({
      config,
      reservedNcpAgentRuntimeKinds: ["native"],
    });
    expect(reloadedRegistry.ncpAgentRuntimes[0]?.label).toBe("Test Runtime v2");
  });
});
