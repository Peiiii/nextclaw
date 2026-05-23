import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { runDesktopCommandBridge } from "./desktop-command-bridge.utils";

function createManifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    installationKind: "installed",
    desktopDataDir: "/desktop-data",
    runtimeHome: "/runtime-home",
    appExecutablePath: "/Applications/NextClaw Desktop.app/Contents/MacOS/NextClaw Desktop",
    commandBridgeScriptPath: "/bridge.js",
    commandSurfaceBinDir: "/desktop-data/command-surface/bin",
    packagedRuntimeScriptPath: "/packaged/runtime/index.js",
    launcherVersion: "0.0.189",
    ...overrides
  };
}

test("desktop command bridge resolves current bundle runtime and forwards args", () => {
  const files = new Map<string, string>([
    ["/surface.json", JSON.stringify(createManifest())],
    ["/desktop-data/current.json", JSON.stringify({ version: "0.19.26" })],
    [
      "/desktop-data/versions/0.19.26/manifest.json",
      JSON.stringify({ entrypoints: { runtimeScript: "runtime/dist/cli/app/index.js" } })
    ]
  ]);
  const existingFiles = new Set<string>([
    "/Applications/NextClaw Desktop.app/Contents/MacOS/NextClaw Desktop",
    "/desktop-data/versions/0.19.26/runtime/dist/cli/app/index.js"
  ]);
  const calls: Array<{ command: string; args: string[]; env: NodeJS.ProcessEnv }> = [];

  const status = runDesktopCommandBridge({
    argv: ["--manifest", "/surface.json", "--", "status", "--json"],
    env: {
      PATH: "/usr/bin",
      NEXTCLAW_RUNTIME_BUNDLE_CHILD: "1",
      NEXTCLAW_DISABLE_RUNTIME_BUNDLE_LAUNCHER: "1"
    },
    readTextFile: (path) => {
      const value = files.get(path);
      if (typeof value !== "string") {
        throw new Error(`unexpected read: ${path}`);
      }
      return value;
    },
    fileExists: (path) => files.has(path) || existingFiles.has(path),
    spawnCommand: (command, args, options) => {
      calls.push({ command, args, env: options.env });
      return { status: 0, signal: null, error: undefined };
    }
  });

  assert.equal(status, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.command, "/Applications/NextClaw Desktop.app/Contents/MacOS/NextClaw Desktop");
  assert.deepEqual(calls[0]?.args, [
    join("/desktop-data/versions/0.19.26", "runtime/dist/cli/app/index.js"),
    "status",
    "--json"
  ]);
  assert.equal(calls[0]?.env.ELECTRON_RUN_AS_NODE, "1");
  assert.equal(calls[0]?.env.NEXTCLAW_HOME, "/runtime-home");
  assert.equal(calls[0]?.env.NEXTCLAW_COMMAND_SURFACE_BIN, "/desktop-data/command-surface/bin");
  assert.equal(calls[0]?.env.NEXTCLAW_DESKTOP_COMMAND_SURFACE, "1");
  assert.equal(calls[0]?.env.NEXTCLAW_RUNTIME_BUNDLE_CHILD, undefined);
  assert.equal(calls[0]?.env.NEXTCLAW_DISABLE_RUNTIME_BUNDLE_LAUNCHER, undefined);
});

test("desktop command bridge falls back to packaged runtime when current pointer is missing", () => {
  const files = new Map<string, string>([
    ["/surface.json", JSON.stringify(createManifest())]
  ]);
  const existingFiles = new Set<string>([
    "/Applications/NextClaw Desktop.app/Contents/MacOS/NextClaw Desktop",
    "/packaged/runtime/index.js"
  ]);
  const calls: string[][] = [];

  const status = runDesktopCommandBridge({
    argv: ["--manifest", "/surface.json", "--", "--version"],
    readTextFile: (path) => {
      const value = files.get(path);
      if (typeof value !== "string") {
        throw new Error(`unexpected read: ${path}`);
      }
      return value;
    },
    fileExists: (path) => files.has(path) || existingFiles.has(path),
    spawnCommand: (_command, args) => {
      calls.push(args);
      return { status: 0, signal: null, error: undefined };
    }
  });

  assert.equal(status, 0);
  assert.deepEqual(calls[0], ["/packaged/runtime/index.js", "--version"]);
});

test("desktop command bridge fails clearly when current runtime script is missing", () => {
  const files = new Map<string, string>([
    ["/surface.json", JSON.stringify(createManifest({ packagedRuntimeScriptPath: null }))],
    ["/desktop-data/current.json", JSON.stringify({ version: "0.19.26" })],
    [
      "/desktop-data/versions/0.19.26/manifest.json",
      JSON.stringify({ entrypoints: { runtimeScript: "runtime/dist/cli/app/index.js" } })
    ]
  ]);

  assert.throws(
    () => runDesktopCommandBridge({
      argv: ["--manifest", "/surface.json", "--", "doctor", "--json"],
      readTextFile: (path) => {
        const value = files.get(path);
        if (typeof value !== "string") {
          throw new Error(`unexpected read: ${path}`);
        }
        return value;
      },
      fileExists: (path) => files.has(path) || path === "/Applications/NextClaw Desktop.app/Contents/MacOS/NextClaw Desktop",
      spawnCommand: () => ({ status: 0, signal: null, error: undefined })
    }),
    /Current desktop bundle runtime script is missing/
  );
});
