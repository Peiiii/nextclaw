import { describe, expect, it, vi } from "vitest";
import { createPluginRuntime, setPluginRuntimeBridge } from "./runtime.js";

describe("createPluginRuntime", () => {
  it("exposes agent runtime helpers for plugin-side provider and prompt resolution", () => {
    const runtime = createPluginRuntime({
      workspace: "/tmp/nextclaw-plugin-runtime",
      config: {
        agents: {
          defaults: {
            workspace: "/tmp/nextclaw-plugin-runtime-default",
            model: "custom-1/gpt-5.4",
            maxToolIterations: 12,
          },
          context: {
            bootstrap: {
              files: [],
              minimalFiles: [],
              heartbeatFiles: [],
              perFileChars: 1000,
              totalChars: 1000,
            },
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
      } as never,
    });

    expect(runtime.agent.defaults).toEqual({
      model: "custom-1/gpt-5.4",
      workspace: "/tmp/nextclaw-plugin-runtime",
      maxToolIterations: 12,
    });
    expect(runtime.agent.resolveWorkspacePath()).toBe("/tmp/nextclaw-plugin-runtime");
    expect(runtime.agent.resolveProviderRuntime("custom-1/gpt-5.4")).toEqual(
      expect.objectContaining({
        providerName: "custom-1",
        providerDisplayName: "yunyi",
        apiBase: "https://yunyi.example.com/v1",
      }),
    );
    expect(
      runtime.agent.buildRuntimeUserPrompt({
        userMessage: "Reply exactly OK",
        metadata: { requested_skills: ["missing-skill"] },
      }),
    ).toContain("Reply exactly OK");
  });

  it("exposes debounce helpers required by channel gateways", async () => {
    const runtime = createPluginRuntime({
      workspace: "/tmp/nextclaw-test",
      config: {
        messages: {
          inbound: {
            debounceMs: 5,
            byChannel: {
              feishu: 20,
            },
          },
        },
      } as never,
    });

    expect(
      runtime.channel.debounce.resolveInboundDebounceMs({
        cfg: runtime.config.loadConfig(),
        channel: "feishu",
      }),
    ).toBe(20);

    const flushed: string[][] = [];
    const debouncer = runtime.channel.debounce.createInboundDebouncer<string>({
      debounceMs: 0,
      buildKey: (value: string) => value,
      onFlush: async (items: string[]) => {
        flushed.push(items);
      },
    });

    await debouncer.enqueue("hello");
    expect(flushed).toEqual([["hello"]]);
  });

  it("bridges dispatchReplyFromConfig through the runtime bridge", async () => {
    const bridgeDispatch = vi.fn(async (params: {
      dispatcherOptions: {
        deliver: (payload: { text?: string }, info: { kind: string }) => void | Promise<void>;
      };
    }) => {
      await params.dispatcherOptions.deliver({ text: "pong" }, { kind: "final" });
    });
    setPluginRuntimeBridge({
      dispatchReplyWithBufferedBlockDispatcher: bridgeDispatch,
    });

    const runtime = createPluginRuntime({
      workspace: "/tmp/nextclaw-test",
    });
    const sendFinalReply = vi.fn(() => true);
    const dispatcher = {
      sendToolResult: vi.fn(() => true),
      sendBlockReply: vi.fn(() => true),
      sendFinalReply,
      waitForIdle: async () => {},
      getQueuedCounts: () => ({
        tool: 0,
        block: 0,
        final: sendFinalReply.mock.calls.length,
      }),
      markComplete: () => {},
    };

    const result = await runtime.channel.reply.dispatchReplyFromConfig({
      ctx: {
        Body: "ping",
      },
      dispatcher,
    });

    expect(bridgeDispatch).toHaveBeenCalledTimes(1);
    expect(sendFinalReply).toHaveBeenCalledWith({ text: "pong" });
    expect(result).toEqual({
      queuedFinal: true,
      counts: {
        tool: 0,
        block: 0,
        final: 1,
      },
    });

    setPluginRuntimeBridge(null);
  });
});
