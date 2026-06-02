import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { createUiRouter } from "./router.js";
import { createRouterTestKernel } from "@nextclaw-server/app/tests/router-test-kernel.js";
import { EventBus } from "@nextclaw/shared";

const tempDirs: string[] = [];

function createTempConfigPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-ui-provider-test-"));
  tempDirs.push(dir);
  return join(dir, "config.json");
}

function createProviderTestApp(configPath: string) {
  return createUiRouter({
    kernel: createRouterTestKernel(),
    configPath,
    appEventBus: new EventBus(),
  });
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

    const app = createProviderTestApp(configPath);

    const response = await app.request(
      "http://localhost/api/providers/not-exists/test",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      },
    );

    expect(response.status).toBe(404);
    const payload = (await response.json()) as {
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

    const app = createProviderTestApp(configPath);
    await app.request("http://localhost/api/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ providerType: "openai" }),
    });

    const response = await app.request(
      "http://localhost/api/providers/openai/test",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          apiKey: "",
        }),
      },
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
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

  it("persists provider custom models and exposes provider default models in meta", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);

    const app = createProviderTestApp(configPath);
    await app.request("http://localhost/api/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ providerType: "deepseek" }),
    });

    const updateResponse = await app.request(
      "http://localhost/api/providers/deepseek",
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          models: [
            " deepseek-chat ",
            "deepseek/deepseek-reasoner",
            "deepseek-chat",
            "",
          ],
        }),
      },
    );
    expect(updateResponse.status).toBe(200);
    const updatePayload = (await updateResponse.json()) as {
      ok: true;
      data: {
        models?: string[];
      };
    };
    expect(updatePayload.ok).toBe(true);
    expect(updatePayload.data.models).toEqual([
      "deepseek-chat",
      "deepseek/deepseek-reasoner",
    ]);

    const configResponse = await app.request("http://localhost/api/config");
    expect(configResponse.status).toBe(200);
    const configPayload = (await configResponse.json()) as {
      ok: true;
      data: {
        providers: Record<string, { models?: string[] }>;
      };
    };
    expect(configPayload.data.providers.deepseek.models).toEqual([
      "deepseek-chat",
      "deepseek/deepseek-reasoner",
    ]);

    const metaResponse = await app.request("http://localhost/api/provider-templates");
    expect(metaResponse.status).toBe(200);
    const metaPayload = (await metaResponse.json()) as {
      ok: true;
      data: {
        providerTemplates: Array<{
          providerType: string;
          defaultModels?: string[];
        }>;
      };
    };
    const deepseekSpec = metaPayload.data.providerTemplates.find(
      (provider) => provider.providerType === "deepseek",
    );
    expect(deepseekSpec?.defaultModels?.length ?? 0).toBeGreaterThan(0);
    expect(deepseekSpec?.defaultModels).toContain("deepseek/deepseek-chat");
  });

  it("generates distinct display names for multiple instances of the same provider type", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);

    const app = createProviderTestApp(configPath);
    const firstResponse = await app.request("http://localhost/api/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ providerType: "openai" }),
    });
    const secondResponse = await app.request("http://localhost/api/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ providerType: "openai" }),
    });

    const firstPayload = (await firstResponse.json()) as {
      ok: true;
      data: { providerId: string; provider: { displayName?: string } };
    };
    const secondPayload = (await secondResponse.json()) as {
      ok: true;
      data: { providerId: string; provider: { displayName?: string } };
    };

    expect(firstPayload.data.providerId).toBe("openai");
    expect(firstPayload.data.provider.displayName).toBe("OpenAI");
    expect(secondPayload.data.providerId).toBe("openai-2");
    expect(secondPayload.data.provider.displayName).toBe("OpenAI 2");
  });

  it("supports creating, renaming, and deleting custom providers", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);

    const app = createProviderTestApp(configPath);

    const createResponse = await app.request(
      "http://localhost/api/providers",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          displayName: "Relay A",
          apiBase: "https://relay-b.example.com/v1",
        }),
      },
    );
    expect(createResponse.status).toBe(200);
    const createPayload = (await createResponse.json()) as {
      ok: true;
      data: {
        providerId: string;
      };
    };
    const customProviderName = createPayload.data.providerId;
    expect(customProviderName).toBe("custom-1");

    const duplicateResponse = await app.request(
      "http://localhost/api/providers",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          providerId: customProviderName,
          displayName: "Relay Duplicate",
        }),
      },
    );
    expect(duplicateResponse.status).toBe(409);

    const updateResponse = await app.request(
      `http://localhost/api/providers/${customProviderName}`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          displayName: "Relay B",
        }),
      },
    );
    expect(updateResponse.status).toBe(200);

    const configResponse = await app.request("http://localhost/api/config");
    expect(configResponse.status).toBe(200);
    const configPayload = (await configResponse.json()) as {
      ok: true;
      data: {
        providers: Record<
          string,
          { displayName?: string; apiBase?: string | null }
        >;
      };
    };
    expect(configPayload.data.providers[customProviderName]?.displayName).toBe(
      "Relay B",
    );
    expect(configPayload.data.providers[customProviderName]?.apiBase).toBe(
      "https://relay-b.example.com/v1",
    );

    const providersResponse = await app.request("http://localhost/api/providers");
    expect(providersResponse.status).toBe(200);
    const providersPayload = (await providersResponse.json()) as {
      ok: true;
      data: {
        providers: Record<string, {
          displayName?: string;
          isCustom?: boolean;
        }>;
      };
    };

    expect(providersPayload.data.providers[customProviderName]?.displayName).toBe("Relay B");
    expect(providersPayload.data.providers[customProviderName]?.isCustom).toBe(true);

    const deleteResponse = await app.request(
      `http://localhost/api/providers/${customProviderName}`,
      {
        method: "DELETE",
      },
    );
    expect(deleteResponse.status).toBe(200);

    const configAfterDelete = await app.request("http://localhost/api/config");
    expect(configAfterDelete.status).toBe(200);
    const configAfterDeletePayload = (await configAfterDelete.json()) as {
      ok: true;
      data: {
        providers: Record<string, { displayName?: string }>;
      };
    };
    expect(
      configAfterDeletePayload.data.providers[customProviderName],
    ).toBeUndefined();
  });
});
