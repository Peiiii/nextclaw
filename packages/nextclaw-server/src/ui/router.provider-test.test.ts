import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, LiteLLMProvider, saveConfig } from "@nextclaw/core";
import { createUiRouter } from "./router.js";

const tempDirs: string[] = [];

function createTempConfigPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-ui-provider-test-"));
  tempDirs.push(dir);
  return join(dir, "config.json");
}

afterEach(() => {
  vi.restoreAllMocks();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("provider connection test route", () => {
  it("returns 404 for unknown provider", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);

    const app = createUiRouter({
      configPath,
      publish: () => {}
    });

    const response = await app.request("http://localhost/api/config/providers/not-exists/test", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({})
    });

    expect(response.status).toBe(404);
    const payload = await response.json() as {
      ok: false;
      error: {
        code: string;
      };
    };
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("NOT_FOUND");
  });

  it("returns a failed result when api key is explicitly empty", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);

    const app = createUiRouter({
      configPath,
      publish: () => {}
    });

    const response = await app.request("http://localhost/api/config/providers/openai/test", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        apiKey: ""
      })
    });

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      ok: true;
      data: {
        success: boolean;
        message: string;
      };
    };
    expect(payload.ok).toBe(true);
    expect(payload.data.success).toBe(false);
    expect(payload.data.message).toContain("API key is required");
  });

  it("uses maxTokens >= 16 when probing provider connection", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);

    const chatSpy = vi.spyOn(LiteLLMProvider.prototype, "chat").mockResolvedValue({
      content: "pong",
      toolCalls: [],
      finishReason: "stop",
      usage: {}
    });

    const app = createUiRouter({
      configPath,
      publish: () => {}
    });

    const response = await app.request("http://localhost/api/config/providers/openai/test", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        apiKey: "sk_test_probe",
        model: "gpt-5.2-codex"
      })
    });

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      ok: true;
      data: {
        success: boolean;
      };
    };
    expect(payload.ok).toBe(true);
    expect(payload.data.success).toBe(true);
    expect(chatSpy).toHaveBeenCalledTimes(1);
    expect(chatSpy.mock.calls[0]?.[0]?.maxTokens).toBeGreaterThanOrEqual(16);
  });

  it("persists provider custom models and exposes provider default models in meta", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);

    const app = createUiRouter({
      configPath,
      publish: () => {}
    });

    const updateResponse = await app.request("http://localhost/api/config/providers/deepseek", {
      method: "PUT",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        models: [" deepseek-chat ", "deepseek/deepseek-reasoner", "deepseek-chat", ""]
      })
    });
    expect(updateResponse.status).toBe(200);
    const updatePayload = await updateResponse.json() as {
      ok: true;
      data: {
        models?: string[];
      };
    };
    expect(updatePayload.ok).toBe(true);
    expect(updatePayload.data.models).toEqual(["deepseek-chat", "deepseek/deepseek-reasoner"]);

    const configResponse = await app.request("http://localhost/api/config");
    expect(configResponse.status).toBe(200);
    const configPayload = await configResponse.json() as {
      ok: true;
      data: {
        providers: Record<string, { models?: string[] }>;
      };
    };
    expect(configPayload.data.providers.deepseek.models).toEqual(["deepseek-chat", "deepseek/deepseek-reasoner"]);

    const metaResponse = await app.request("http://localhost/api/config/meta");
    expect(metaResponse.status).toBe(200);
    const metaPayload = await metaResponse.json() as {
      ok: true;
      data: {
        providers: Array<{
          name: string;
          defaultModels?: string[];
        }>;
      };
    };
    const deepseekSpec = metaPayload.data.providers.find((provider) => provider.name === "deepseek");
    expect(deepseekSpec?.defaultModels?.length ?? 0).toBeGreaterThan(0);
    expect(deepseekSpec?.defaultModels).toContain("deepseek/deepseek-chat");
  });

  it("supports creating, renaming, and deleting custom providers", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);

    const app = createUiRouter({
      configPath,
      publish: () => {}
    });

    const createResponse = await app.request("http://localhost/api/config/providers", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        displayName: "Relay A",
        apiBase: "https://relay-b.example.com/v1"
      })
    });
    expect(createResponse.status).toBe(200);
    const createPayload = await createResponse.json() as {
      ok: true;
      data: {
        name: string;
      };
    };
    const customProviderName = createPayload.data.name;
    expect(customProviderName).toBe("custom-1");

    const updateResponse = await app.request(`http://localhost/api/config/providers/${customProviderName}`, {
      method: "PUT",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        displayName: "Relay B"
      })
    });
    expect(updateResponse.status).toBe(200);

    const configResponse = await app.request("http://localhost/api/config");
    expect(configResponse.status).toBe(200);
    const configPayload = await configResponse.json() as {
      ok: true;
      data: {
        providers: Record<string, { displayName?: string; apiBase?: string | null }>;
      };
    };
    expect(configPayload.data.providers[customProviderName]?.displayName).toBe("Relay B");
    expect(configPayload.data.providers[customProviderName]?.apiBase).toBe("https://relay-b.example.com/v1");

    const metaResponse = await app.request("http://localhost/api/config/meta");
    expect(metaResponse.status).toBe(200);
    const metaPayload = await metaResponse.json() as {
      ok: true;
      data: {
        providers: Array<{
          name: string;
          displayName?: string;
          isCustom?: boolean;
        }>;
      };
    };

    expect(metaPayload.data.providers[0]?.isCustom).toBe(true);
    expect(metaPayload.data.providers[0]?.name).toBe(customProviderName);
    const customSpec = metaPayload.data.providers.find((provider) => provider.name === customProviderName);
    expect(customSpec?.displayName).toBe("Relay B");
    expect(customSpec?.isCustom).toBe(true);

    const deleteResponse = await app.request(`http://localhost/api/config/providers/${customProviderName}`, {
      method: "DELETE"
    });
    expect(deleteResponse.status).toBe(200);

    const configAfterDelete = await app.request("http://localhost/api/config");
    expect(configAfterDelete.status).toBe(200);
    const configAfterDeletePayload = await configAfterDelete.json() as {
      ok: true;
      data: {
        providers: Record<string, { displayName?: string }>;
      };
    };
    expect(configAfterDeletePayload.data.providers[customProviderName]).toBeUndefined();
  });

  it("exposes qwen-portal auth metadata in provider meta", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);

    const app = createUiRouter({
      configPath,
      publish: () => {}
    });

    const metaResponse = await app.request("http://localhost/api/config/meta");
    expect(metaResponse.status).toBe(200);
    const metaPayload = await metaResponse.json() as {
      ok: true;
      data: {
        providers: Array<{
          name: string;
          auth?: {
            kind: string;
            supportsCliImport?: boolean;
          };
        }>;
      };
    };
    const qwenPortal = metaPayload.data.providers.find((provider) => provider.name === "qwen-portal");
    expect(qwenPortal).toBeDefined();
    expect(qwenPortal?.auth?.kind).toBe("device_code");
    expect(qwenPortal?.auth?.supportsCliImport).toBe(true);
  });

  it("completes qwen-portal device auth and stores access token", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);

    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        device_code: "device-code-123",
        user_code: "ABCD-EFGH",
        verification_uri: "https://chat.qwen.ai/device",
        verification_uri_complete: "https://chat.qwen.ai/device?code=ABCD-EFGH",
        expires_in: 600,
        interval: 2
      }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "qwen-access-token",
        refresh_token: "qwen-refresh-token",
        expires_in: 3600
      }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      }));

    const app = createUiRouter({
      configPath,
      publish: () => {}
    });

    const startResponse = await app.request("http://localhost/api/config/providers/qwen-portal/auth/start", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({})
    });
    expect(startResponse.status).toBe(200);
    const startPayload = await startResponse.json() as {
      ok: true;
      data: {
        sessionId: string;
      };
    };
    const sessionId = startPayload.data.sessionId;
    expect(sessionId).toBeTruthy();

    const pollResponse = await app.request("http://localhost/api/config/providers/qwen-portal/auth/poll", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sessionId
      })
    });
    expect(pollResponse.status).toBe(200);
    const pollPayload = await pollResponse.json() as {
      ok: true;
      data: {
        status: string;
      };
    };
    expect(pollPayload.data.status).toBe("authorized");

    const configResponse = await app.request("http://localhost/api/config");
    expect(configResponse.status).toBe(200);
    const configPayload = await configResponse.json() as {
      ok: true;
      data: {
        providers: Record<string, { apiKeySet: boolean; apiBase?: string | null }>;
      };
    };
    expect(configPayload.data.providers["qwen-portal"]?.apiKeySet).toBe(true);
    expect(configPayload.data.providers["qwen-portal"]?.apiBase).toBe("https://portal.qwen.ai/v1");

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("imports qwen-portal access token from qwen cli credentials", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    const fakeHome = mkdtempSync(join(tmpdir(), "nextclaw-qwen-home-"));
    tempDirs.push(fakeHome);
    const qwenDir = join(fakeHome, ".qwen");
    mkdirSync(qwenDir, { recursive: true });
    writeFileSync(
      join(qwenDir, "oauth_creds.json"),
      JSON.stringify({
        access_token: "qwen-cli-access-token",
        refresh_token: "qwen-cli-refresh-token",
        expiry_date: Date.now() + 3600 * 1000
      })
    );

    const originalHome = process.env.HOME;
    process.env.HOME = fakeHome;
    try {
      const app = createUiRouter({
        configPath,
        publish: () => {}
      });

      const importResponse = await app.request("http://localhost/api/config/providers/qwen-portal/auth/import-cli", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({})
      });
      expect(importResponse.status).toBe(200);
      const importPayload = await importResponse.json() as {
        ok: true;
        data: {
          status: string;
        };
      };
      expect(importPayload.data.status).toBe("imported");

      const configResponse = await app.request("http://localhost/api/config");
      expect(configResponse.status).toBe(200);
      const configPayload = await configResponse.json() as {
        ok: true;
        data: {
          providers: Record<string, { apiKeySet: boolean; apiBase?: string | null }>;
        };
      };
      expect(configPayload.data.providers["qwen-portal"]?.apiKeySet).toBe(true);
      expect(configPayload.data.providers["qwen-portal"]?.apiBase).toBe("https://portal.qwen.ai/v1");
    } finally {
      process.env.HOME = originalHome;
    }
  });

  it("returns 400 when qwen cli credentials file is missing", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    const fakeHome = mkdtempSync(join(tmpdir(), "nextclaw-qwen-home-missing-"));
    tempDirs.push(fakeHome);

    const originalHome = process.env.HOME;
    process.env.HOME = fakeHome;
    try {
      const app = createUiRouter({
        configPath,
        publish: () => {}
      });

      const importResponse = await app.request("http://localhost/api/config/providers/qwen-portal/auth/import-cli", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({})
      });
      expect(importResponse.status).toBe(400);
      const payload = await importResponse.json() as {
        ok: false;
        error: {
          code: string;
          message: string;
        };
      };
      expect(payload.error.code).toBe("AUTH_IMPORT_FAILED");
      expect(payload.error.message).toContain("failed to read CLI credential");
    } finally {
      process.env.HOME = originalHome;
    }
  });

  it("returns 400 when imported qwen cli credential is expired", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    const fakeHome = mkdtempSync(join(tmpdir(), "nextclaw-qwen-home-expired-"));
    tempDirs.push(fakeHome);
    const qwenDir = join(fakeHome, ".qwen");
    mkdirSync(qwenDir, { recursive: true });
    writeFileSync(
      join(qwenDir, "oauth_creds.json"),
      JSON.stringify({
        access_token: "expired-qwen-access-token",
        refresh_token: "expired-qwen-refresh-token",
        expiry_date: Date.now() - 1000
      })
    );

    const originalHome = process.env.HOME;
    process.env.HOME = fakeHome;
    try {
      const app = createUiRouter({
        configPath,
        publish: () => {}
      });

      const importResponse = await app.request("http://localhost/api/config/providers/qwen-portal/auth/import-cli", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({})
      });
      expect(importResponse.status).toBe(400);
      const payload = await importResponse.json() as {
        ok: false;
        error: {
          code: string;
          message: string;
        };
      };
      expect(payload.error.code).toBe("AUTH_IMPORT_FAILED");
      expect(payload.error.message).toContain("expired");
    } finally {
      process.env.HOME = originalHome;
    }
  });
});
