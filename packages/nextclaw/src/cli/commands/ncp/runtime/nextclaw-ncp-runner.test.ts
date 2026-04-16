import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, SessionManager, type Config } from "@nextclaw/core";
import { NcpEventType } from "@nextclaw/ncp";
import {
  dispatchPromptOverNcp,
  runGatewayInboundLoop,
} from "./nextclaw-ncp-dispatch.js";
import { createChannelReplyRouterService } from "./runner/channel-reply-router.service.js";
import { createNextclawNcpRunnerService } from "./runner/nextclaw-ncp-runner.service.js";

const tempWorkspaces: string[] = [];

function createWorkspace(): string {
  const workspace = mkdtempSync(
    join(tmpdir(), "nextclaw-ncp-runner-test-"),
  );
  tempWorkspaces.push(workspace);
  return workspace;
}

afterEach(() => {
  while (tempWorkspaces.length > 0) {
    const workspace = tempWorkspaces.pop();
    if (!workspace) {
      continue;
    }
    rmSync(workspace, { recursive: true, force: true });
  }
});

function createConfig(workspace: string): Config {
  return ConfigSchema.parse({
    agents: {
      defaults: {
        workspace,
        model: "openai/gpt-5",
      },
    },
  });
}

function createNcpAgent(params?: {
  text?: string;
  metadata?: Record<string, unknown>;
  events?: Array<{ type: string; payload: Record<string, unknown> }>;
}) {
  const assetApiPut = vi.fn(async () => ({ uri: "asset://uploaded-file" }));
  const send = vi.fn(
    async function* (input: {
      sessionId: string;
      message: {
        sessionId: string;
        parts: Array<Record<string, unknown>>;
        metadata?: Record<string, unknown>;
      };
      metadata?: Record<string, unknown>;
    }) {
      for (const event of params?.events ?? []) {
        yield event;
      }
      yield {
        type: NcpEventType.MessageCompleted,
        payload: {
          message: {
            id: `${input.sessionId}:assistant`,
            sessionId: input.sessionId,
            role: "assistant",
            status: "final",
            timestamp: new Date().toISOString(),
            parts:
              params?.text === undefined ? [] : [{ type: "text", text: params.text }],
            metadata: structuredClone(params?.metadata ?? input.metadata ?? {}),
          },
        },
      };
    },
  );

  return {
    agent: {
      runApi: {
        send,
        stream: vi.fn(),
        abort: vi.fn(),
      },
      sessionApi: {} as never,
      assetApi: { put: assetApiPut },
    },
    send,
    assetApiPut,
  };
}

describe("dispatchPromptOverNcp", () => {
  it("executes slash command before NCP dispatch", async () => {
    const workspace = createWorkspace();
    const sessionManager = new SessionManager(workspace);
    const ncpAgent = createNcpAgent({ text: "ncp-reply" });

    const result = await dispatchPromptOverNcp({
      config: createConfig(workspace),
      sessionManager,
      resolveNcpAgent: () => ncpAgent.agent as never,
      content: "/status",
      sessionKey: "agent:main:ui:direct:web-ui",
      channel: "ui",
      chatId: "web-ui",
    });

    expect(result).toContain("Session: agent:main:ui:direct:web-ui");
    expect(ncpAgent.send).not.toHaveBeenCalled();
  });

  it("falls back to NCP dispatch for normal messages", async () => {
    const workspace = createWorkspace();
    const sessionManager = new SessionManager(workspace);
    const ncpAgent = createNcpAgent({ text: "ncp-reply" });

    const result = await dispatchPromptOverNcp({
      config: createConfig(workspace),
      sessionManager,
      resolveNcpAgent: () => ncpAgent.agent as never,
      content: "hello",
      sessionKey: "agent:main:ui:direct:web-ui",
      channel: "ui",
      chatId: "web-ui",
    });

    expect(result).toBe("ncp-reply");
    expect(ncpAgent.send).toHaveBeenCalledTimes(1);
    expect(ncpAgent.send).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "agent:main:ui:direct:web-ui",
        metadata: expect.objectContaining({
          agent_id: "main",
          channel: "ui",
          chatId: "web-ui",
        }),
      }),
      {},
    );
  });

  it("uploads local attachments and forwards assetUri parts to NCP", async () => {
    const workspace = createWorkspace();
    const sessionManager = new SessionManager(workspace);
    const ncpAgent = createNcpAgent({ text: "image reply" });
    const attachmentPath = join(workspace, "inbound-image.png");
    writeFileSync(attachmentPath, "fake-image");

    const result = await dispatchPromptOverNcp({
      config: createConfig(workspace),
      sessionManager,
      resolveNcpAgent: () => ncpAgent.agent as never,
      content: "describe image",
      sessionKey: "agent:main:feishu:direct:oc-chat",
      channel: "feishu",
      chatId: "oc-chat",
      attachments: [
        {
          path: attachmentPath,
          mimeType: "image/png",
          status: "ready",
        },
      ],
    });

    expect(result).toBe("image reply");
    expect(ncpAgent.assetApiPut).toHaveBeenCalledTimes(1);
    expect(ncpAgent.send).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          parts: [
            { type: "text", text: "describe image" },
            expect.objectContaining({
              type: "file",
              assetUri: "asset://uploaded-file",
              mimeType: "image/png",
            }),
          ],
        }),
      }),
      {},
    );
  });
});

describe("runPromptOverNcp", () => {
  it("collects final reply while preserving event callbacks", async () => {
    const runnerService = createNextclawNcpRunnerService();
    const ncpAgent = createNcpAgent({
      text: "final reply",
      events: [
        {
          type: NcpEventType.MessageTextDelta,
          payload: { sessionId: "session-1", messageId: "assistant-1", delta: "Hello " },
        },
        {
          type: NcpEventType.MessageTextDelta,
          payload: { sessionId: "session-1", messageId: "assistant-1", delta: "world" },
        },
      ],
    });
    const observedEvents: string[] = [];
    const observedDeltas: string[] = [];

    const result = await runnerService.runPromptOverNcp({
      agent: ncpAgent.agent as never,
      sessionId: "session-1",
      content: "hello",
      onEvent: (event) => {
        observedEvents.push(event.type);
      },
      onAssistantDelta: (delta) => {
        observedDeltas.push(delta);
      },
    });

    expect(result.text).toBe("final reply");
    expect(observedDeltas).toEqual(["Hello ", "world"]);
    expect(observedEvents).toEqual([
      NcpEventType.MessageTextDelta,
      NcpEventType.MessageTextDelta,
      NcpEventType.MessageCompleted,
    ]);
  });
});

describe("streamPromptOverNcp", () => {
  it("exposes the raw NCP event stream without collapsing it", async () => {
    const runnerService = createNextclawNcpRunnerService();
    const ncpAgent = createNcpAgent({
      text: "final reply",
      events: [
        {
          type: NcpEventType.MessageTextStart,
          payload: { sessionId: "session-1", messageId: "assistant-1" },
        },
        {
          type: NcpEventType.MessageTextDelta,
          payload: { sessionId: "session-1", messageId: "assistant-1", delta: "Hello" },
        },
      ],
    });
    const observedEvents: string[] = [];
    const streamedTypes: string[] = [];

    for await (const event of runnerService.streamPromptOverNcp({
      agent: ncpAgent.agent as never,
      sessionId: "session-1",
      content: "hello",
      onEvent: (nextEvent) => {
        observedEvents.push(nextEvent.type);
      },
    })) {
      streamedTypes.push(event.type);
    }

    expect(streamedTypes).toEqual([
      NcpEventType.MessageTextStart,
      NcpEventType.MessageTextDelta,
      NcpEventType.MessageCompleted,
    ]);
    expect(observedEvents).toEqual(streamedTypes);
  });
});

describe("runGatewayInboundLoop", () => {
  it("routes reply-capable channels through direct NCP event streams", async () => {
    const workspace = createWorkspace();
    const ncpAgent = createNcpAgent({
      text: "Hello",
      events: [
        {
          type: NcpEventType.MessageTextStart,
          payload: {
            sessionId: "agent:main:weixin:direct:user-1@im.wechat",
            messageId: "assistant-1",
          },
        },
        {
          type: NcpEventType.MessageTextDelta,
          payload: {
            sessionId: "agent:main:weixin:direct:user-1@im.wechat",
            messageId: "assistant-1",
            delta: "Hello",
          },
        },
      ],
    });
    const inboundQueue: Array<Record<string, unknown> | null> = [
      {
        channel: "weixin",
        senderId: "user-1@im.wechat",
        chatId: "user-1@im.wechat",
        content: "hello",
        timestamp: new Date(),
        attachments: [],
        metadata: {
          accountId: "bot-1@im.bot",
          context_token: "ctx-1",
          message_id: "wx-1",
        },
      },
      null,
    ];
    const bus = {
      consumeInbound: vi.fn(async () => {
        const next = inboundQueue.shift();
        if (!next) {
          throw new Error("stop-loop");
        }
        return next;
      }),
      publishOutbound: vi.fn(async () => undefined),
    };
    const consumed: Array<{ target: Record<string, unknown>; eventTypes: string[] }> = [];
    const channel = {
      consumeNcpReply: vi.fn(async (input: { target: Record<string, unknown>; eventStream: AsyncIterable<{ type: string }> }) => {
        const eventTypes: string[] = [];
        for await (const event of input.eventStream) {
          eventTypes.push(event.type);
        }
        consumed.push({
          target: input.target,
          eventTypes,
        });
      }),
    };

    await expect(
      runGatewayInboundLoop({
        bus: bus as never,
        sessionManager: new SessionManager(workspace),
        getConfig: () => createConfig(workspace),
        resolveNcpAgent: () => ncpAgent.agent as never,
        getChannels: () =>
          ({
            getChannel: vi.fn(() => channel),
          }) as never,
        replyRouter: createChannelReplyRouterService(),
      }),
    ).rejects.toThrow("stop-loop");

    expect(channel.consumeNcpReply).toHaveBeenCalledTimes(1);
    expect(bus.publishOutbound).not.toHaveBeenCalled();
    expect(consumed).toEqual([
      {
        target: expect.objectContaining({
          conversationId: "user-1@im.wechat",
          participantId: "user-1@im.wechat",
          accountId: "bot-1@im.bot",
          messageId: "wx-1",
        }),
        eventTypes: [
          NcpEventType.MessageTextStart,
          NcpEventType.MessageTextDelta,
          NcpEventType.MessageCompleted,
        ],
      },
    ]);
  });

  it("streams reset, delta, and final reply for non-system messages", async () => {
    const workspace = createWorkspace();
    const ncpAgent = createNcpAgent({
      text: "final reply",
      events: [
        {
          type: NcpEventType.MessageTextDelta,
          payload: { delta: "partial" },
        },
      ],
    });
    const inboundQueue: Array<Record<string, unknown> | null> = [
      {
        channel: "feishu",
        senderId: "ou_sender",
        chatId: "oc_chat",
        content: "hello",
        timestamp: new Date(),
        attachments: [],
        metadata: {},
      },
      null,
    ];
    const bus = {
      consumeInbound: vi.fn(async () => {
        const next = inboundQueue.shift();
        if (!next) {
          throw new Error("stop-loop");
        }
        return next;
      }),
      publishOutbound: vi.fn(async () => undefined),
    };

    await expect(
      runGatewayInboundLoop({
        bus: bus as never,
        sessionManager: new SessionManager(workspace),
        getConfig: () => createConfig(workspace),
        resolveNcpAgent: () => ncpAgent.agent as never,
      }),
    ).rejects.toThrow("stop-loop");

    expect(bus.publishOutbound).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        channel: "feishu",
        chatId: "oc_chat",
        content: "",
      }),
    );
    expect(bus.publishOutbound).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        channel: "feishu",
        chatId: "oc_chat",
        content: "",
      }),
    );
    expect(bus.publishOutbound).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        channel: "feishu",
        chatId: "oc_chat",
        content: "final reply",
      }),
    );
  });

  it("routes system messages back to session_key_override and emits session update hook", async () => {
    const workspace = createWorkspace();
    const ncpAgent = createNcpAgent({ text: "ignored" });
    const inboundQueue: Array<Record<string, unknown> | null> = [
      {
        channel: "system",
        senderId: "subagent",
        chatId: "ui:web-ui",
        content: "subagent done",
        timestamp: new Date(),
        attachments: [],
        metadata: {
          session_key_override: "agent:main:ui:direct:web-ui",
          target_agent_id: "main",
        },
      },
      null,
    ];
    const bus = {
      consumeInbound: vi.fn(async () => {
        const next = inboundQueue.shift();
        if (!next) {
          throw new Error("stop-loop");
        }
        return next;
      }),
      publishOutbound: vi.fn(async () => undefined),
    };
    const sessionUpdated = vi.fn();

    await expect(
      runGatewayInboundLoop({
        bus: bus as never,
        sessionManager: new SessionManager(workspace),
        getConfig: () => createConfig(workspace),
        resolveNcpAgent: () => ncpAgent.agent as never,
        onSystemSessionUpdated: sessionUpdated,
      }),
    ).rejects.toThrow("stop-loop");

    expect(ncpAgent.send).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "agent:main:ui:direct:web-ui",
        metadata: expect.objectContaining({
          agent_id: "main",
          channel: "system",
          chatId: "ui:web-ui",
        }),
      }),
      {},
    );
    expect(sessionUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionKey: "agent:main:ui:direct:web-ui",
      }),
    );
  });
});
