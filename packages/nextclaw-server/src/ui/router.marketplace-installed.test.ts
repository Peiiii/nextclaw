import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { createUiRouter } from "./router.js";

const tempDirs: string[] = [];

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function createTempConfigPath(): string {
  return join(createTempDir("nextclaw-ui-marketplace-installed-"), "config.json");
}

function createMarketplaceProbePlugin(): { pluginDir: string; markerPath: string } {
  const pluginDir = createTempDir("nextclaw-marketplace-probe-plugin-");
  const markerPath = join(pluginDir, "marker.txt");

  mkdirSync(join(pluginDir, "dist"), { recursive: true });
  writeFileSync(
    join(pluginDir, "package.json"),
    JSON.stringify(
      {
        name: "@test/marketplace-installed-probe",
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
        id: "marketplace-installed-probe",
        kind: "agent-runtime",
        name: "Marketplace Installed Probe",
        description: "Writes a marker when imported.",
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
      `appendFileSync(${JSON.stringify(markerPath)}, 'imported\\n');`,
      "",
      "export default {",
      "  id: 'marketplace-installed-probe',",
      "  name: 'Marketplace Installed Probe',",
      "  configSchema: { type: 'object', additionalProperties: true, properties: {} },",
      "  register(api) {",
      "    api.registerNcpAgentRuntime({",
      "      kind: 'marketplace-installed-probe-runtime',",
      "      label: 'Marketplace Probe Runtime',",
      "      createRuntime() {",
      "        return { async *run() {} };",
      "      }",
      "    });",
      "  }",
      "};",
    ].join("\n")
  );

  return { pluginDir, markerPath };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("marketplace installed plugins route", () => {
  it("returns installed external plugins without importing their runtime modules", async () => {
    const configPath = createTempConfigPath();
    const { pluginDir, markerPath } = createMarketplaceProbePlugin();

    saveConfig(
      ConfigSchema.parse({
        plugins: {
          load: {
            paths: [pluginDir]
          },
          entries: {
            "marketplace-installed-probe": {
              enabled: true
            }
          },
          installs: {
            "marketplace-installed-probe": {
              spec: "@test/marketplace-installed-probe",
              source: "npm",
              installPath: pluginDir,
              installedAt: "2026-03-24T00:00:00.000Z"
            }
          }
        }
      }),
      configPath
    );

    const app = createUiRouter({
      configPath,
      publish: () => {}
    });

    const response = await app.request("http://localhost/api/marketplace/plugins/installed");
    expect(response.status).toBe(200);

    const payload = await response.json() as {
      ok: boolean;
      data: {
        records: Array<{
          id: string;
          spec: string;
          runtimeStatus: string;
        }>;
      };
    };

    expect(payload.ok).toBe(true);
    expect(payload.data.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "marketplace-installed-probe",
          spec: "@test/marketplace-installed-probe",
          runtimeStatus: "loaded"
        })
      ])
    );
    expect(() => readFileSync(markerPath, "utf8")).toThrow();
  });

  it("normalizes discovered local plugin specs to the package name when no install record exists", async () => {
    const configPath = createTempConfigPath();
    const { pluginDir, markerPath } = createMarketplaceProbePlugin();

    saveConfig(
      ConfigSchema.parse({
        plugins: {
          load: {
            paths: [pluginDir]
          },
          entries: {
            "marketplace-installed-probe": {
              enabled: true
            }
          }
        }
      }),
      configPath
    );

    const app = createUiRouter({
      configPath,
      publish: () => {}
    });

    const response = await app.request("http://localhost/api/marketplace/plugins/installed");
    expect(response.status).toBe(200);

    const payload = await response.json() as {
      ok: boolean;
      data: {
        records: Array<{
          id: string;
          spec: string;
          runtimeStatus: string;
        }>;
      };
    };

    expect(payload.ok).toBe(true);
    expect(payload.data.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "marketplace-installed-probe",
          spec: "@test/marketplace-installed-probe",
          runtimeStatus: "loaded"
        })
      ])
    );
    expect(() => readFileSync(markerPath, "utf8")).toThrow();
  });
});
