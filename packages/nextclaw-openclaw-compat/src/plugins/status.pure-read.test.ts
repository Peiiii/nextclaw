import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigSchema } from "@nextclaw/core";
import { buildPluginStatusReport, discoverPluginStatusReport } from "./status.js";

const tempDirs: string[] = [];

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function createProbePluginDir(): { rootDir: string; pluginDir: string; markerPath: string } {
  const rootDir = createTempDir("nextclaw-status-pure-read-");
  const pluginDir = join(rootDir, "plugin");
  const markerPath = join(rootDir, "marker.txt");

  mkdirSync(join(pluginDir, "dist"), { recursive: true });
  writeFileSync(
    join(pluginDir, "package.json"),
    JSON.stringify(
      {
        name: "@test/status-pure-read-plugin",
        version: "0.0.1",
        type: "module",
        openclaw: {
          extensions: ["dist/index.js"]
        }
      },
      null,
      2
    )
  );
  writeFileSync(
    join(pluginDir, "openclaw.plugin.json"),
    JSON.stringify(
      {
        id: "status-pure-read-plugin",
        kind: "agent-runtime",
        name: "Status Pure Read Plugin",
        version: "0.0.1",
        configSchema: {
          type: "object",
          additionalProperties: true,
          properties: {}
        }
      },
      null,
      2
    )
  );
  writeFileSync(
    join(pluginDir, "dist", "index.js"),
    [
      "import { appendFileSync } from 'node:fs';",
      `appendFileSync(${JSON.stringify(markerPath)}, 'loaded\\n');`,
      "export default {",
      "  id: 'status-pure-read-plugin',",
      "  name: 'Status Pure Read Plugin',",
      "  configSchema: { type: 'object', additionalProperties: true, properties: {} },",
      "  register(api) {",
      "    api.registerNcpAgentRuntime({",
      "      kind: 'status-pure-read-runtime',",
      "      label: 'Status Pure Read Runtime',",
      "      createRuntime() {",
      "        return { async *run() {} };",
      "      }",
      "    });",
      "  }",
      "};"
    ].join("\n")
  );

  return { rootDir, pluginDir, markerPath };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("plugin status report read vs load behavior", () => {
  it("discovers plugins without importing runtime modules", () => {
    const { rootDir, pluginDir, markerPath } = createProbePluginDir();
    const config = ConfigSchema.parse({
      plugins: {
        load: {
          paths: [pluginDir]
        },
        allow: ["status-pure-read-plugin"],
        entries: {
          "status-pure-read-plugin": {
            enabled: true
          }
        }
      }
    });

    const report = discoverPluginStatusReport({
      config,
      workspaceDir: rootDir
    });

    expect(report.plugins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "status-pure-read-plugin",
          status: "loaded"
        })
      ])
    );
    expect(() => readFileSync(markerPath, "utf8")).toThrow();
  });

  it("keeps full status report importing runtime modules", () => {
    const { rootDir, pluginDir, markerPath } = createProbePluginDir();
    const config = ConfigSchema.parse({
      plugins: {
        load: {
          paths: [pluginDir]
        },
        allow: ["status-pure-read-plugin"],
        entries: {
          "status-pure-read-plugin": {
            enabled: true
          }
        }
      }
    });

    const report = buildPluginStatusReport({
      config,
      workspaceDir: rootDir
    });

    expect(report.plugins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "status-pure-read-plugin",
          status: "loaded"
        })
      ])
    );
    expect(readFileSync(markerPath, "utf8")).toContain("loaded");
  });
});
