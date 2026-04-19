import { describe, expect, it, vi } from "vitest";
import { createPluginRuntime } from "@nextclaw/openclaw-compat";
import { ConfigSchema, type Config } from "@nextclaw/core";
import type { RuntimeFactoryParams } from "@nextclaw/ncp-toolkit";
import type { NcpAgentRuntime } from "@nextclaw/ncp";
import codexRuntimePlugin from "../../../../../../extensions/nextclaw-ncp-runtime-plugin-codex-sdk/src/index.js";

vi.mock(
  "../../../../../../extensions/nextclaw-ncp-runtime-plugin-codex-sdk/src/codex-responses-capability.utils.js",
  () => ({
    resolveCodexResponsesApiSupport: vi.fn(async () => true),
  }),
);

function createConfig(input: Record<string, unknown> = {}): Config {
  return ConfigSchema.parse({
    agents: {
      defaults: {
        workspace: "/tmp/nextclaw-codex-runtime-plugin-provider-routing",
        model: "custom-1/gpt-5.4",
      },
    },
    providers: {
      "custom-1": {
        displayName: "yunyi",
        apiKey: "test-key",
        apiBase: "https://yunyi.example.com/v1",
        models: ["gpt-5.4"],
      },
    },
    ...input,
  });
}

async function createRuntimeConfig(params?: {
  config?: Config;
  pluginConfig?: Record<string, unknown>;
  sessionMetadata?: Record<string, unknown>;
  resolveAssetContentPath?: RuntimeFactoryParams["resolveAssetContentPath"];
}): Promise<Record<string, unknown>> {
  let createRuntime: ((runtimeParams: RuntimeFactoryParams) => NcpAgentRuntime) | null = null;

  codexRuntimePlugin.register({
    config: params?.config ?? createConfig({}),
    pluginConfig: params?.pluginConfig,
    runtime: createPluginRuntime({
      workspace:
        params?.config?.agents.defaults.workspace ??
        "/tmp/nextclaw-codex-runtime-plugin-provider-routing",
      config: params?.config ?? createConfig({}),
    }),
    registerNcpAgentRuntime(registration) {
      createRuntime = registration.createRuntime;
    },
  });

  if (!createRuntime) {
    throw new Error("codex runtime registration missing");
  }

  const runtimeFactory = createRuntime as unknown as (runtimeParams: RuntimeFactoryParams) => NcpAgentRuntime;
  const runtime = runtimeFactory({
    sessionId: "session-1",
    stateManager: undefined as never,
    sessionMetadata: params?.sessionMetadata ?? {
      preferred_model: "custom-1/gpt-5.4",
    },
    setSessionMetadata: vi.fn(),
    resolveAssetContentPath: params?.resolveAssetContentPath,
  });

  const resolveRuntime = Reflect.get(runtime as object, "createRuntime");
  if (typeof resolveRuntime !== "function") {
    throw new Error("runtime resolver is missing");
  }

  const resolvedRuntime = await Reflect.apply(resolveRuntime, runtime, []);
  const runtimeConfig = Reflect.get(resolvedRuntime as object, "config");
  if (!runtimeConfig || typeof runtimeConfig !== "object") {
    throw new Error("runtime config is missing");
  }
  return runtimeConfig as Record<string, unknown>;
}

describe("codex runtime plugin provider routing", () => {
  it("maps custom provider displayName to Codex model_provider", async () => {
    const runtimeConfig = await createRuntimeConfig();
    const cliConfig = runtimeConfig.cliConfig as Record<string, unknown>;
    const modelProviders = cliConfig.model_providers as Record<string, Record<string, unknown>>;
    const threadOptions = runtimeConfig.threadOptions as Record<string, unknown>;

    expect(runtimeConfig.model).toBe("gpt-5.4");
    expect(cliConfig.model_provider).toBe("yunyi");
    expect(threadOptions).toEqual(
      expect.objectContaining({
        sandboxMode: "danger-full-access",
        approvalPolicy: "never",
      }),
    );
    expect(modelProviders.yunyi).toEqual(
      expect.objectContaining({
        name: "yunyi",
        base_url: "https://yunyi.example.com/v1",
      }),
    );
  });

  it("prefers explicit modelProvider override for custom providers", async () => {
    const runtimeConfig = await createRuntimeConfig({
      config: createConfig({
        providers: {
          "custom-1": {
            displayName: "Relay B",
            apiKey: "test-key",
            apiBase: "https://yunyi.example.com/v1",
            models: ["gpt-5.4"],
          },
        },
      }),
      pluginConfig: {
        modelProvider: "yunyi",
      },
    });
    const cliConfig = runtimeConfig.cliConfig as Record<string, unknown>;

    expect(cliConfig.model_provider).toBe("yunyi");
  });

  it("maps explicit accessMode to the runtime permission profile", async () => {
    const runtimeConfig = await createRuntimeConfig({
      pluginConfig: {
        accessMode: "workspace-write",
      },
    });
    const threadOptions = runtimeConfig.threadOptions as Record<string, unknown>;

    expect(threadOptions).toEqual(
      expect.objectContaining({
        sandboxMode: "workspace-write",
        approvalPolicy: "never",
      }),
    );
  });

  it("keeps reading legacy sandboxMode during the migration", async () => {
    const runtimeConfig = await createRuntimeConfig({
      pluginConfig: {
        sandboxMode: "read-only",
      },
    });
    const threadOptions = runtimeConfig.threadOptions as Record<string, unknown>;

    expect(threadOptions).toEqual(
      expect.objectContaining({
        sandboxMode: "read-only",
        approvalPolicy: "never",
      }),
    );
  });

  it("passes asset path resolution into the codex input builder", async () => {
    const runtimeConfig = await createRuntimeConfig({
      resolveAssetContentPath: (assetUri) =>
        assetUri === "asset://store/2026/04/09/asset_123" ? "/tmp/assets/screen.png" : null,
    });
    const inputBuilder = runtimeConfig.inputBuilder as (input: {
      sessionId: string;
      messages: Array<Record<string, unknown>>;
    }) => Promise<unknown>;

    const prompt = await inputBuilder({
      sessionId: "session-1",
      messages: [
        {
          id: "message-1",
          sessionId: "session-1",
          role: "user",
          status: "final",
          timestamp: "2026-04-09T00:00:00.000Z",
          parts: [
            { type: "text", text: "describe this image" },
            {
              type: "file",
              name: "screen.png",
              mimeType: "image/png",
              assetUri: "asset://store/2026/04/09/asset_123",
              sizeBytes: 2048,
            },
          ],
        },
      ],
    });

    expect(prompt).toEqual([
      {
        type: "text",
        text: expect.stringContaining("describe this image"),
      },
      {
        type: "local_image",
        path: "/tmp/assets/screen.png",
      },
    ]);
  });

  it("fails fast when a custom provider has no valid external provider id", async () => {
    await expect(
      createRuntimeConfig({
        config: createConfig({
          providers: {
            "custom-1": {
              displayName: "Relay B",
              apiKey: "test-key",
              apiBase: "https://yunyi.example.com/v1",
              models: ["gpt-5.4"],
            },
          },
        }),
      }),
    ).rejects.toThrowError(/config\.modelProvider/);
  });
});
