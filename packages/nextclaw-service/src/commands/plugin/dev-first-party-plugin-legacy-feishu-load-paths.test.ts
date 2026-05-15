import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigSchema, ENV_HOME_KEY } from "@nextclaw/core";
import {
  applyDevFirstPartyPluginLoadPaths,
  resolveDevFirstPartyPluginLoadPaths,
} from "./development-source/first-party-plugin-load-paths.utils.js";

const tempDirs: string[] = [];
const originalHomeDir = process.env[ENV_HOME_KEY];

const createTempDir = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "nextclaw-dev-legacy-feishu-plugin-"));
  tempDirs.push(dir);
  return dir;
};

const writeLegacyFeishuPluginPackage = (rootDir: string) => {
  const packageDir = path.join(rootDir, "nextclaw-channel-plugin-feishu");
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(
    path.join(packageDir, "package.json"),
    JSON.stringify({
      name: "@nextclaw/channel-plugin-feishu",
      version: "0.0.0-test",
      openclaw: {
        extensions: ["dist/index.js"],
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

describe("legacy Feishu first-party plugin load paths", () => {
  it("keeps the legacy Feishu plugin out of dev runtime load paths", () => {
    const workspaceExtensionsDir = createTempDir();
    writeLegacyFeishuPluginPackage(workspaceExtensionsDir);
    const config = ConfigSchema.parse({
      agents: {
        defaults: {
          workspace: createTempDir(),
          model: "openai/gpt-5",
        },
      },
      plugins: {
        installs: {
          feishu: {
            source: "npm",
            spec: "@nextclaw/channel-plugin-feishu",
          },
        },
      },
    });

    expect(resolveDevFirstPartyPluginLoadPaths(config, workspaceExtensionsDir)).toEqual([]);
    expect(applyDevFirstPartyPluginLoadPaths(config, workspaceExtensionsDir).plugins.load?.paths).toBeUndefined();
  });
});
