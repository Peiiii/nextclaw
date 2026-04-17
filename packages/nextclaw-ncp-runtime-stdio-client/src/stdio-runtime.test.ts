import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NcpEventType, type NcpEndpointEvent } from "@nextclaw/ncp";
import {
  probeStdioRuntime,
  StdioRuntimeConfigResolver,
  StdioRuntimeNcpAgentRuntime,
} from "./index.js";

const FIXTURE_PATH = join(
  import.meta.dirname,
  "test-fixtures",
  "echo-agent.mjs",
);

describe("StdioRuntimeConfigResolver", () => {
  it("reads command and args from explicit config", () => {
    const resolver = new StdioRuntimeConfigResolver({
      wireDialect: "acp",
      processScope: "per-session",
      command: process.execPath,
      args: [FIXTURE_PATH],
      startupTimeoutMs: 1234,
      probeTimeoutMs: 2222,
      requestTimeoutMs: 4567,
    });

    expect(resolver.resolve()).toEqual({
      wireDialect: "acp",
      processScope: "per-session",
      command: process.execPath,
      args: [FIXTURE_PATH],
      startupTimeoutMs: 1234,
      probeTimeoutMs: 2222,
      requestTimeoutMs: 4567,
    });
  });
});

describe("StdioRuntimeNcpAgentRuntime", () => {
  it("bridges ACP stdio updates into NCP events and forwards prompt meta", async () => {
    const runtime = new StdioRuntimeNcpAgentRuntime({
      sessionId: "session-stdio-runtime",
      wireDialect: "acp",
      processScope: "per-session",
      command: process.execPath,
      args: [FIXTURE_PATH],
      startupTimeoutMs: 10_000,
      probeTimeoutMs: 3_000,
      requestTimeoutMs: 30_000,
      resolveTools: () => [
        {
          type: "function",
          function: {
            name: "list_dir",
            description: "List files",
            parameters: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
          },
        },
      ],
      resolveProviderRoute: () => ({
        model: "MiniMax-M2.7",
        apiKey: "minimax-key",
        apiBase: "https://api.minimax.chat/v1",
        headers: {
          "x-minimax-group-id": "test-group",
        },
      }),
    });

    const events: NcpEndpointEvent[] = [];
    for await (const event of runtime.run({
      sessionId: "session-stdio-runtime",
      messages: [
        {
          id: "user-1",
          sessionId: "session-stdio-runtime",
          role: "user",
          status: "final",
          timestamp: "2026-04-16T00:00:00.000Z",
          parts: [{ type: "text", text: "ping over stdio" }],
        },
      ],
      correlationId: "corr-1",
      metadata: {
        preferredModel: "minimax/MiniMax-M2.7",
      },
    })) {
      events.push(event);
    }

    expect(events.map((event) => event.type)).toEqual([
      NcpEventType.MessageAccepted,
      NcpEventType.RunStarted,
      NcpEventType.MessageReasoningStart,
      NcpEventType.MessageReasoningDelta,
      NcpEventType.MessageToolCallStart,
      NcpEventType.MessageToolCallArgs,
      NcpEventType.MessageToolCallEnd,
      NcpEventType.MessageToolCallResult,
      NcpEventType.MessageTextStart,
      NcpEventType.MessageTextDelta,
      NcpEventType.MessageTextEnd,
      NcpEventType.MessageReasoningEnd,
      NcpEventType.MessageCompleted,
      NcpEventType.RunFinished,
    ]);

    const acceptedEvent = events.find(
      (event): event is Extract<NcpEndpointEvent, { type: NcpEventType.MessageAccepted }> =>
        event.type === NcpEventType.MessageAccepted,
    );
    expect(acceptedEvent?.payload.messageId).toBeDefined();
    expect(acceptedEvent?.payload.messageId).not.toBe("user-1");

    const toolResultEvent = events.find(
      (event): event is Extract<NcpEndpointEvent, { type: NcpEventType.MessageToolCallResult }> =>
        event.type === NcpEventType.MessageToolCallResult,
    );
    expect(toolResultEvent?.payload.content).toEqual({
      modelId: "MiniMax-M2.7",
      routedModel: "MiniMax-M2.7",
      envRoutedModel: "MiniMax-M2.7",
      headerKeys: ["x-minimax-group-id"],
      envHeaderKeys: ["x-minimax-group-id"],
      toolNames: ["list_dir"],
    });

    const completedEvent = events.find(
      (event): event is Extract<NcpEndpointEvent, { type: NcpEventType.MessageCompleted }> =>
        event.type === NcpEventType.MessageCompleted,
    );
    expect(completedEvent?.payload.message.id).toBe(acceptedEvent?.payload.messageId);
    expect(completedEvent?.payload.message.id).not.toBe("user-1");
    expect(completedEvent?.payload.message.parts).toEqual([
      { type: "reasoning", text: "reasoning via ACP" },
      {
        type: "tool-invocation",
        toolCallId: "call-1",
        toolName: "emit_meta",
        state: "call",
        args: "{\"requested\":true}",
      },
      { type: "text", text: "pong via ACP" },
    ]);

    const runFinishedEvent = events.find(
      (event): event is Extract<NcpEndpointEvent, { type: NcpEventType.RunFinished }> =>
        event.type === NcpEventType.RunFinished,
    );
    expect(runFinishedEvent?.payload.messageId).toBe(acceptedEvent?.payload.messageId);
  });

  it("fails cleanly when the stdio command cannot be spawned", async () => {
    const runtime = new StdioRuntimeNcpAgentRuntime({
      sessionId: "session-stdio-missing-command",
      wireDialect: "acp",
      processScope: "per-session",
      command: "/definitely/missing/hermes",
      args: ["acp"],
      startupTimeoutMs: 5_000,
      probeTimeoutMs: 1_000,
      requestTimeoutMs: 5_000,
    });

    await expect(
      (async () => {
        for await (const _event of runtime.run({
          sessionId: "session-stdio-missing-command",
          messages: [
            {
              id: "user-1",
              sessionId: "session-stdio-missing-command",
              role: "user",
              status: "final",
              timestamp: "2026-04-17T00:00:00.000Z",
              parts: [{ type: "text", text: "ping" }],
            },
          ],
        })) {
          // no-op
        }
      })(),
    ).rejects.toThrow(/failed to start stdio runtime command/);
  });
});

describe("probeStdioRuntime", () => {
  it("fails cleanly when the probe command cannot be spawned", async () => {
    await expect(
      probeStdioRuntime({
        wireDialect: "acp",
        processScope: "per-session",
        command: "/definitely/missing/hermes",
        args: ["acp"],
        startupTimeoutMs: 5_000,
        probeTimeoutMs: 1_000,
        requestTimeoutMs: 5_000,
      }),
    ).rejects.toThrow(/failed to start stdio runtime command/);
  });
});
