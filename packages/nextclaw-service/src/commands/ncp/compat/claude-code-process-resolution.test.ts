import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveBundledClaudeAgentSdkCliPath } from "../../../../../extensions/nextclaw-ncp-runtime-claude-code-sdk/src/claude-code-process-resolution.js";

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-claude-resolution-"));
  tempDirs.push(dir);
  return dir;
}

function writeFakeClaudeAgentSdkPackage(params: {
  rootDir: string;
  exportPackageJson: boolean;
}): string {
  const packageDir = join(params.rootDir, "node_modules", "@anthropic-ai", "claude-agent-sdk");
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(
    join(packageDir, "package.json"),
    JSON.stringify(
      {
        name: "@anthropic-ai/claude-agent-sdk",
        type: "module",
        exports: params.exportPackageJson
          ? {
              ".": {
                default: "./sdk.mjs",
              },
              "./package.json": "./package.json",
            }
          : {
              ".": {
                default: "./sdk.mjs",
              },
            },
      },
      null,
      2,
    ),
  );
  writeFileSync(join(packageDir, "sdk.mjs"), "export const query = () => null;\n");
  writeFileSync(join(packageDir, "cli.js"), "console.log('fake claude cli');\n");
  return packageDir;
}

function createInstalledRuntimeResolver(rootDir: string): (specifier: string) => string {
  const runtimeDistPath = join(rootDir, "node_modules", "@nextclaw", "fake-runtime", "dist", "index.js");
  mkdirSync(dirname(runtimeDistPath), { recursive: true });
  writeFileSync(runtimeDistPath, "");
  return createRequire(runtimeDistPath).resolve;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("resolveBundledClaudeAgentSdkCliPath", () => {
  it("falls back to the package entry when package.json is not exported", () => {
    const rootDir = createTempDir();
    const packageDir = writeFakeClaudeAgentSdkPackage({
      rootDir,
      exportPackageJson: false,
    });
    const resolveModulePath = createInstalledRuntimeResolver(rootDir);

    expect(() => resolveModulePath("@anthropic-ai/claude-agent-sdk/package.json")).toThrow(/not defined by "exports"/);
    expect(realpathSync(resolveBundledClaudeAgentSdkCliPath(resolveModulePath) ?? "")).toBe(
      realpathSync(join(packageDir, "cli.js")),
    );
  });

  it("still resolves cli.js when package.json is exported", () => {
    const rootDir = createTempDir();
    const packageDir = writeFakeClaudeAgentSdkPackage({
      rootDir,
      exportPackageJson: true,
    });
    const resolveModulePath = createInstalledRuntimeResolver(rootDir);

    expect(realpathSync(resolveBundledClaudeAgentSdkCliPath(resolveModulePath) ?? "")).toBe(
      realpathSync(join(packageDir, "cli.js")),
    );
  });
});
