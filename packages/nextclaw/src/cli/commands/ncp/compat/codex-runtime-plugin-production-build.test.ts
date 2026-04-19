import { describe, expect, it, vi } from "vitest";
import { createPluginRuntime } from "@nextclaw/openclaw-compat";
import { ConfigSchema, type Config } from "@nextclaw/core";
import type { RuntimeFactoryParams } from "@nextclaw/ncp-toolkit";
import type { NcpAgentRuntime } from "@nextclaw/ncp";
import codexRuntimePlugin from "../../../../../../extensions/nextclaw-ncp-runtime-plugin-codex-sdk/dist/index.js";

vi.mock(
  "../../../../../../extensions/nextclaw-ncp-runtime-plugin-codex-sdk/dist/codex-responses-capability.utils.js",
  () => ({
    resolveCodexResponsesApiSupport: vi.fn(async () => true),
  }),
);

function createConfig(input: Record<string, unknown> = {}): Config {
  return ConfigSchema.parse({
    agents: {
      defaults: {
        workspace: "/tmp/nextclaw-codex-runtime-plugin-production-build",
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

async function createRuntimeConfig({
  config,
  pluginConfig,
  sessionMetadata,
  resolveAssetContentPath,
}: {
  config?: Config;
  pluginConfig?: Record<string, unknown>;
  sessionMetadata?: Record<string, unknown>;
  resolveAssetContentPath?: RuntimeFactoryParams["resolveAssetContentPath"];
} = {}): Promise<Record<string, unknown>> {
  let createRuntime: ((runtimeParams: RuntimeFactoryParams) => NcpAgentRuntime) | null = null;

  codexRuntimePlugin.register({
    config: config ?? createConfig({}),
    pluginConfig,
    runtime: createPluginRuntime({
      workspace:
        config?.agents.defaults.workspace ??
        "/tmp/nextclaw-codex-runtime-plugin-production-build",
      config: config ?? createConfig({}),
    }),
    registerNcpAgentRuntime: (registration) => {
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
    sessionMetadata: sessionMetadata ?? {
      preferred_model: "custom-1/gpt-5.4",
    },
    setSessionMetadata: vi.fn(),
    resolveAssetContentPath,
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

describe("codex runtime plugin production build", () => {
  it("keeps image asset path resolution in the production dist build", async () => {
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
});
