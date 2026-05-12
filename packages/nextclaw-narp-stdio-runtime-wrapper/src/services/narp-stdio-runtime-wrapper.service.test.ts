import { describe, expect, it } from "vitest";
import type * as acp from "@agentclientprotocol/sdk";
import {
  type NcpAgentRunInput,
  type NcpAgentRunOptions,
  type NcpAgentRuntime,
  type NcpEndpointEvent,
  NcpEventType,
} from "@nextclaw/ncp";
import {
  NARP_STDIO_PROMPT_META_KEY,
  NarpStdioRuntimeWrapperAgent,
} from "./narp-stdio-runtime-wrapper.service.js";
import type { NarpStdioRuntimeWrapperContext } from "@/types/narp-stdio-runtime-wrapper.types.js";

class FakeRuntime implements NcpAgentRuntime {
  readonly inputs: NcpAgentRunInput[] = [];
  readonly options: Array<NcpAgentRunOptions | undefined> = [];

  async *run(
    input: NcpAgentRunInput,
    options?: NcpAgentRunOptions,
  ): AsyncGenerator<NcpEndpointEvent> {
    this.inputs.push(input);
    this.options.push(options);

    yield {
      type: NcpEventType.MessageReasoningDelta,
      payload: {
        sessionId: input.sessionId,
        messageId: "assistant-1",
        delta: "thinking",
      },
    };
    yield {
      type: NcpEventType.MessageToolCallStart,
      payload: {
        sessionId: input.sessionId,
        messageId: "assistant-1",
        toolCallId: "tool-1",
        toolName: "inspect",
      },
    };
    yield {
      type: NcpEventType.MessageToolCallArgs,
      payload: {
        sessionId: input.sessionId,
        toolCallId: "tool-1",
        args: "{\"path\":\"/tmp\"}",
      },
    };
    yield {
      type: NcpEventType.MessageToolCallEnd,
      payload: {
        sessionId: input.sessionId,
        toolCallId: "tool-1",
      },
    };
    yield {
      type: NcpEventType.MessageToolCallResult,
      payload: {
        sessionId: input.sessionId,
        toolCallId: "tool-1",
        content: { ok: true },
      },
    };
    yield {
      type: NcpEventType.MessageTextDelta,
      payload: {
        sessionId: input.sessionId,
        messageId: "assistant-1",
        delta: "done",
      },
    };
  }
}

describe("NarpStdioRuntimeWrapperAgent", () => {
  it("wraps an NCP runtime as ACP session updates", async () => {
    const updates: acp.SessionUpdate[] = [];
    const runtime = new FakeRuntime();
    const contexts: NarpStdioRuntimeWrapperContext[] = [];
    const agent = new NarpStdioRuntimeWrapperAgent(
      {
        sessionUpdate: async ({ update }) => {
          updates.push(update);
        },
      },
      {
        agentName: "test-narp-wrapper",
        createRuntime: (context) => {
          contexts.push(context);
          return runtime;
        },
      },
    );

    const initialized = await agent.initialize();
    const session = await agent.newSession({
      cwd: "/tmp/project",
      mcpServers: [],
    });
    await agent.unstable_setSessionModel({
      sessionId: session.sessionId,
      modelId: "model-from-client",
    });
    const response = await agent.prompt({
      sessionId: session.sessionId,
      messageId: "user-1",
      prompt: [{ type: "text", text: "hello" }],
      _meta: {
        [NARP_STDIO_PROMPT_META_KEY]: {
          correlationId: "corr-1",
          providerRoute: {
            model: "route-model",
            apiKey: "route-key",
            apiBase: "https://example.test/v1",
            headers: { "x-route": "1" },
          },
          sessionMetadata: { project_root: "/tmp/project" },
        },
      },
    });

    expect(initialized.agentInfo?.name).toBe("test-narp-wrapper");
    expect(response).toEqual({
      stopReason: "end_turn",
      userMessageId: "user-1",
    });
    expect(contexts).toEqual([
      {
        sessionId: session.sessionId,
        cwd: "/tmp/project",
        modelId: "model-from-client",
        promptMeta: {
          correlationId: "corr-1",
          providerRoute: {
            model: "route-model",
            apiKey: "route-key",
            apiBase: "https://example.test/v1",
            headers: { "x-route": "1" },
          },
          sessionMetadata: { project_root: "/tmp/project" },
        },
      },
    ]);
    expect(runtime.inputs[0]).toMatchObject({
      sessionId: session.sessionId,
      correlationId: "corr-1",
      metadata: { project_root: "/tmp/project" },
      messages: [
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "hello" }],
        },
      ],
    });
    expect(updates).toEqual([
      {
        sessionUpdate: "agent_thought_chunk",
        content: { type: "text", text: "thinking" },
        messageId: "assistant-1",
      },
      {
        sessionUpdate: "tool_call",
        toolCallId: "tool-1",
        title: "inspect",
        kind: "execute",
        status: "pending",
      },
      {
        sessionUpdate: "tool_call_update",
        toolCallId: "tool-1",
        status: "in_progress",
        rawInput: { path: "/tmp" },
      },
      {
        sessionUpdate: "tool_call_update",
        toolCallId: "tool-1",
        status: "completed",
      },
      {
        sessionUpdate: "tool_call_update",
        toolCallId: "tool-1",
        status: "completed",
        rawOutput: { ok: true },
      },
      {
        sessionUpdate: "agent_message_chunk",
        content: { type: "text", text: "done" },
        messageId: "assistant-1",
      },
    ]);
  });
});
