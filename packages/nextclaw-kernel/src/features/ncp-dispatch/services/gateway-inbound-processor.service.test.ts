import { describe, expect, it, vi } from "vitest";
import { DIAGNOSTIC_CORRELATION_METADATA_KEY } from "@nextclaw/core";
import { GatewayInboundProcessor } from "./gateway-inbound-processor.service.js";

describe("GatewayInboundProcessor diagnostics", () => {
  it("keeps the channel correlation through route, Agent wait, reply, and outbound metadata", async () => {
    const record = vi.fn((event) => event);
    const publishOutbound = vi.fn(async () => undefined);
    const processor = new GatewayInboundProcessor({
      kernel: {
        channels: { getChannel: () => null } as never,
        assetStore: {} as never,
        diagnostics: {
          record,
          readCorrelationId: (metadata) =>
            typeof metadata?.[DIAGNOSTIC_CORRELATION_METADATA_KEY] === "string"
              ? metadata[DIAGNOSTIC_CORRELATION_METADATA_KEY]
              : undefined,
        } as never,
      },
      agentRunClient: {
        sendAndWaitForReply: vi.fn(async () => ({
          text: "reply",
          completedMessage: {
            id: "assistant-1",
            sessionId: "session-1",
            role: "assistant",
            status: "final",
            timestamp: "2026-08-20T00:00:01.000Z",
            parts: [{ type: "text", text: "reply" }],
            metadata: {},
          },
        })),
      } as never,
      messageBus: { publishOutbound } as never,
      sessionManager: {} as never,
      configManager: {
        loadConfig: () => ({
          agents: { list: [] },
          bindings: [],
          session: { dmScope: "per-channel-peer" },
        }) as never,
      },
    });

    await processor.process({
      channel: "qq",
      senderId: "sender-1",
      chatId: "chat-1",
      content: "hello",
      timestamp: new Date("2026-08-20T00:00:00.000Z"),
      attachments: [],
      metadata: { [DIAGNOSTIC_CORRELATION_METADATA_KEY]: "trace-qq-1" },
    });

    const events = record.mock.calls.map((call) => call[0]);
    expect(events.map((event) => event.event)).toEqual([
      "route.resolved",
      "agent.reply-wait.started",
      "agent.reply-wait.completed",
      "reply.queued",
    ]);
    expect(events.every((event) => event.correlationId === "trace-qq-1")).toBe(true);
    const reply = publishOutbound.mock.calls.at(-1)?.[0];
    expect(reply?.metadata[DIAGNOSTIC_CORRELATION_METADATA_KEY]).toBe("trace-qq-1");
  });
});
