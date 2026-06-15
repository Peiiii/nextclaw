import { describe, expect, it } from "vitest";
import { RUNTIME_DEFAULT_MODEL_VALUE } from "@nextclaw/shared";
import type { NcpAgentRunInput } from "@nextclaw/ncp";
import { BuiltinNarpRuntimeProviderService, NARP_STDIO_RUNTIME_KIND } from "./builtin-narp-runtime-provider.service.js";

function createRunInput(metadata?: Record<string, unknown>): NcpAgentRunInput {
  return {
    sessionId: "session-1",
    messages: [
      {
        id: "message-1",
        sessionId: "session-1",
        role: "user",
        status: "final",
        timestamp: "2026-06-10T00:00:00.000Z",
        parts: [{ type: "text", text: "hello" }],
      },
    ],
    ...(metadata ? { metadata } : {}),
  };
}

function createRuntimeConfig(params: {
  entryConfig?: Record<string, unknown>;
  sessionMetadata?: Record<string, unknown>;
}) {
  const service = new BuiltinNarpRuntimeProviderService({
    loadConfig: () => ({
      agents: { defaults: { model: "openai/gpt-5" } },
      providers: {
        openai: {
          apiKey: "test-key",
          modelConfig: { "gpt-5": {} },
        },
      },
    }) as never,
  });
  const provider = service
    .createProviders()
    .find((item) => item.kind === NARP_STDIO_RUNTIME_KIND);
  const runtime = provider?.createRuntimeForEntry?.({
    entry: {
      id: "external",
      label: "External",
      type: NARP_STDIO_RUNTIME_KIND,
      config: {
        command: "external-narp",
        ...params.entryConfig,
      },
    },
    runtimeParams: {
      sessionMetadata: params.sessionMetadata ?? {},
    },
  });
  return (runtime as never as {
    config: {
      resolveProviderRoute?: (input: NcpAgentRunInput) => unknown;
    };
  }).config;
}

describe("BuiltinNarpRuntimeProviderService", () => {
  it("publishes runtime default thinking from runtime entry config without runtime-id branching", async () => {
    const service = new BuiltinNarpRuntimeProviderService({
      loadConfig: () => ({
        agents: { defaults: { model: "openai/gpt-5" } },
      }) as never,
    });
    const provider = service
      .createProviders()
      .find((item) => item.kind === NARP_STDIO_RUNTIME_KIND);

    await expect(provider?.describeSessionTypeForEntry?.({
      entry: {
        id: "external",
        label: "External",
        type: NARP_STDIO_RUNTIME_KIND,
        config: {
          command: "node",
          runtimeDefaultThinking: {
            supported: ["off", "minimal", "high", "unknown"],
            default: "high",
          },
        },
      },
    })).resolves.toMatchObject({
      runtimeDefaultThinking: {
        supported: ["off", "minimal", "high"],
        default: "high",
      },
    });
  });

  it("keeps the default NextClaw model route by default", () => {
    const config = createRuntimeConfig({});

    expect(config.resolveProviderRoute?.(createRunInput())).toMatchObject({
      model: "gpt-5",
      apiKey: "test-key",
    });
  });

  it("does not build a provider route when the runtime entry owns model selection", () => {
    const config = createRuntimeConfig({
      entryConfig: { modelSelectionMode: "runtime-default" },
      sessionMetadata: { preferred_model: "openai/gpt-5" },
    });

    expect(config.resolveProviderRoute?.(createRunInput({
      preferred_model: "openai/gpt-5",
    }))).toBeUndefined();
  });

  it("lets an optional runtime use its own default for the runtime default sentinel", () => {
    const config = createRuntimeConfig({
      entryConfig: { modelSelectionMode: "optional", model: "openai/gpt-5" },
      sessionMetadata: { preferred_model: "openai/gpt-5" },
    });

    expect(config.resolveProviderRoute?.(createRunInput({
      preferred_model: RUNTIME_DEFAULT_MODEL_VALUE,
    }))).toBeUndefined();
  });
});
