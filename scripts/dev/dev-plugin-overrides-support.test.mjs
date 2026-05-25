import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  inspectProductionBuildStatus,
  resolveFirstPartyPluginRef,
} from "./dev-plugin-overrides-support.mjs";

const tempDirs = [];

function createTempDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function createPluginDir(params) {
  const { dirName, extensionsDir, packageName, pluginId } = params;
  const pluginPath = join(extensionsDir, dirName);
  mkdirSync(join(pluginPath, "src"), { recursive: true });
  mkdirSync(join(pluginPath, "dist"), { recursive: true });
  writeFileSync(
    join(pluginPath, "package.json"),
    JSON.stringify(
      {
        name: packageName,
        version: "0.0.0-test",
        scripts: {
          build: "echo build",
        },
        openclaw: {
          extensions: ["dist/index.js"],
          development: {
            extensions: ["src/index.ts"],
          },
        },
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(pluginPath, "openclaw.plugin.json"),
    JSON.stringify(
      {
        id: pluginId,
        kind: "channel",
        name: pluginId,
        version: "0.0.0-test",
      },
      null,
      2,
    ),
  );
  writeFileSync(join(pluginPath, "src/index.ts"), "export default {};\n");
  writeFileSync(join(pluginPath, "dist/index.js"), "export default {};\n");
  return pluginPath;
}

test.afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

test("resolveFirstPartyPluginRef matches exact plugin id inside packages/extensions", () => {
  const rootDir = createTempDir("nextclaw-dev-start-plugins-root-");
  const extensionsDir = join(rootDir, "packages", "extensions");
  mkdirSync(extensionsDir, { recursive: true });
  const pluginPath = createPluginDir({
    extensionsDir,
    dirName: "community-slack-connector",
    pluginId: "community-slack-connector",
    packageName: "@community/slack-channel",
  });

  const resolved = resolveFirstPartyPluginRef(rootDir, "community-slack-connector");

  assert.equal(resolved.pluginId, "community-slack-connector");
  assert.equal(resolved.pluginPath, pluginPath);
});

test("resolveFirstPartyPluginRef rejects ambiguous suffix matches", () => {
  const rootDir = createTempDir("nextclaw-dev-start-plugins-root-");
  const extensionsDir = join(rootDir, "packages", "extensions");
  mkdirSync(extensionsDir, { recursive: true });
  createPluginDir({
    extensionsDir,
    dirName: "community-slack-connector",
    pluginId: "community-slack-connector",
    packageName: "@community/slack-channel",
  });
  createPluginDir({
    extensionsDir,
    dirName: "community-image-slack-connector",
    pluginId: "community-image-slack-connector",
    packageName: "@community/image-slack-channel",
  });

  assert.throws(
    () => resolveFirstPartyPluginRef(rootDir, "connector"),
    /ambiguous/,
  );
});

test("inspectProductionBuildStatus reports stale when source is newer than dist", () => {
  const rootDir = createTempDir("nextclaw-dev-start-plugins-root-");
  const extensionsDir = join(rootDir, "packages", "extensions");
  mkdirSync(extensionsDir, { recursive: true });
  const pluginPath = createPluginDir({
    extensionsDir,
    dirName: "community-slack-connector",
    pluginId: "community-slack-connector",
    packageName: "@community/slack-channel",
  });

  utimesSync(join(pluginPath, "dist/index.js"), new Date(1_000), new Date(1_000));
  utimesSync(join(pluginPath, "src/index.ts"), new Date(2_000), new Date(2_000));

  const status = inspectProductionBuildStatus(pluginPath);

  assert.equal(status.stale, true);
  assert.match(status.reason ?? "", /older than plugin source files/);
});

test("inspectProductionBuildStatus accepts fresh production dist", () => {
  const rootDir = createTempDir("nextclaw-dev-start-plugins-root-");
  const extensionsDir = join(rootDir, "packages", "extensions");
  mkdirSync(extensionsDir, { recursive: true });
  const pluginPath = createPluginDir({
    extensionsDir,
    dirName: "community-slack-connector",
    pluginId: "community-slack-connector",
    packageName: "@community/slack-channel",
  });

  utimesSync(join(pluginPath, "src/index.ts"), new Date(1_000), new Date(1_000));
  utimesSync(join(pluginPath, "package.json"), new Date(1_000), new Date(1_000));
  utimesSync(join(pluginPath, "openclaw.plugin.json"), new Date(1_000), new Date(1_000));
  utimesSync(join(pluginPath, "dist/index.js"), new Date(2_000), new Date(2_000));

  const status = inspectProductionBuildStatus(pluginPath);

  assert.equal(status.stale, false);
});
