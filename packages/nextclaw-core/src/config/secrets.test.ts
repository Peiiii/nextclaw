import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigSchema } from "./schema.js";
import { hasSecretRef, normalizeInlineSecretRefs, resolveConfigSecrets } from "./secrets.js";

const tempDirs: string[] = [];

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("config secrets", () => {
  it("resolves env secret refs for provider api key", () => {
    const config = ConfigSchema.parse({
      providers: {
        openai: {
          apiKey: ""
        }
      },
      secrets: {
        refs: {
          "providers.openai.apiKey": {
            source: "env",
            id: "OPENAI_API_KEY"
          }
        }
      }
    });

    expect(hasSecretRef(config, "providers.openai.apiKey")).toBe(true);

    const resolved = resolveConfigSecrets(config, {
      env: {
        OPENAI_API_KEY: "sk-env-123"
      }
    });

    expect(resolved.providers.openai.apiKey).toBe("sk-env-123");
    expect(config.providers.openai.apiKey).toBe("");
  });

  it("resolves file secret refs", () => {
    const dir = createTempDir("nextclaw-secrets-file-");
    const configPath = join(dir, "config.json");
    const secretFilePath = join(dir, "secrets.json");
    writeFileSync(secretFilePath, JSON.stringify({ openai: "sk-file-456" }, null, 2));

    const config = ConfigSchema.parse({
      providers: {
        openai: {
          apiKey: ""
        }
      },
      secrets: {
        providers: {
          "file-main": {
            source: "file",
            path: "./secrets.json"
          }
        },
        refs: {
          "providers.openai.apiKey": {
            source: "file",
            provider: "file-main",
            id: "openai"
          }
        }
      }
    });

    const resolved = resolveConfigSecrets(config, { configPath });
    expect(resolved.providers.openai.apiKey).toBe("sk-file-456");
  });

  it("resolves exec secret refs", () => {
    const config = ConfigSchema.parse({
      providers: {
        openai: {
          apiKey: ""
        }
      },
      secrets: {
        providers: {
          "exec-main": {
            source: "exec",
            command: process.execPath,
            args: ["-e", "process.stdout.write(JSON.stringify({openai:'sk-exec-789'}))"]
          }
        },
        refs: {
          "providers.openai.apiKey": {
            source: "exec",
            provider: "exec-main",
            id: "openai"
          }
        }
      }
    });

    const resolved = resolveConfigSecrets(config);
    expect(resolved.providers.openai.apiKey).toBe("sk-exec-789");
  });

  it("normalizes inline secret refs to secrets.refs", () => {
    const normalized = normalizeInlineSecretRefs({
      providers: {
        openai: {
          apiKey: {
            source: "env",
            id: "OPENAI_API_KEY"
          }
        }
      }
    });

    expect(normalized.providers).toEqual({
      openai: {
        apiKey: ""
      }
    });

    const parsed = ConfigSchema.parse(normalized);
    expect(parsed.secrets.refs["providers.openai.apiKey"]).toEqual({
      source: "env",
      id: "OPENAI_API_KEY"
    });
  });
});
