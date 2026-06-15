#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { Readable, Writable } from "node:stream";
import * as acp from "@agentclientprotocol/sdk";
import type { AgentSideConnection } from "@agentclientprotocol/sdk";
import {
  type NcpAgentRunInput,
  type NcpAgentRuntime,
  type NcpEndpointEvent,
  NcpEventType,
} from "@nextclaw/ncp";
import type {
  NarpStdioPromptMeta,
  NarpStdioRuntimeWrapperConfig,
} from "@narp-stdio-wrapper/types/narp-stdio-runtime-wrapper.types.js";

export const NARP_STDIO_PROMPT_META_KEY = "nextclaw_narp";

type WrapperSession = {
  cwd?: string;
  modelId?: string;
  abortController?: AbortController;
};

type AcpConnection = Pick<AgentSideConnection, "sessionUpdate">;

type ToolCallState = {
  toolName: string;
  rawInput: string;
  started: boolean;
  completed: boolean;
};

class NcpToAcpSessionUpdateTranslator {
  private readonly tools = new Map<string, ToolCallState>();

  translate = (event: NcpEndpointEvent): acp.SessionUpdate[] => {
    switch (event.type) {
      case NcpEventType.MessageTextDelta:
        return [
          {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: event.payload.delta },
            messageId: event.payload.messageId,
          },
        ];
      case NcpEventType.MessageReasoningDelta:
        return [
          {
            sessionUpdate: "agent_thought_chunk",
            content: { type: "text", text: event.payload.delta },
            messageId: event.payload.messageId,
          },
        ];
      case NcpEventType.MessageToolCallStart:
        return this.translateToolCallStart(event);
      case NcpEventType.MessageToolCallArgs:
        return this.translateToolCallArgs(event.payload.toolCallId, event.payload.args);
      case NcpEventType.MessageToolCallArgsDelta:
        return this.translateToolCallArgsDelta(event.payload.toolCallId, event.payload.delta);
      case NcpEventType.MessageToolCallEnd:
        return this.translateToolCallEnd(event.payload.toolCallId);
      case NcpEventType.MessageToolCallResult:
        return this.translateToolCallResult(event.payload.toolCallId, event.payload.content);
      default:
        return [];
    }
  };

  private translateToolCallStart = (
    event: Extract<NcpEndpointEvent, { type: NcpEventType.MessageToolCallStart }>,
  ): acp.SessionUpdate[] => {
    this.tools.set(event.payload.toolCallId, {
      toolName: event.payload.toolName,
      rawInput: "{}",
      started: true,
      completed: false,
    });
    return [
      {
        sessionUpdate: "tool_call",
        toolCallId: event.payload.toolCallId,
        title: event.payload.toolName,
        kind: "execute",
        status: "pending",
      },
    ];
  };

  private translateToolCallArgs = (
    toolCallId: string,
    args: string,
  ): acp.SessionUpdate[] => {
    const tool = this.ensureTool(toolCallId);
    tool.rawInput = args;
    return [
      {
        sessionUpdate: "tool_call_update",
        toolCallId,
        status: "in_progress",
        rawInput: parseToolPayload(args),
      },
    ];
  };

  private translateToolCallArgsDelta = (
    toolCallId: string,
    delta: string,
  ): acp.SessionUpdate[] => {
    const tool = this.ensureTool(toolCallId);
    tool.rawInput = `${tool.rawInput === "{}" ? "" : tool.rawInput}${delta}`;
    return [
      {
        sessionUpdate: "tool_call_update",
        toolCallId,
        status: "in_progress",
        rawInput: parseToolPayload(tool.rawInput),
      },
    ];
  };

  private translateToolCallEnd = (toolCallId: string): acp.SessionUpdate[] => {
    const tool = this.ensureTool(toolCallId);
    if (tool.completed) {
      return [];
    }
    tool.completed = true;
    return [
      {
        sessionUpdate: "tool_call_update",
        toolCallId,
        status: "completed",
      },
    ];
  };

  private translateToolCallResult = (
    toolCallId: string,
    content: unknown,
  ): acp.SessionUpdate[] => [
    {
      sessionUpdate: "tool_call_update",
      toolCallId,
      status: "completed",
      rawOutput: content,
    },
  ];

  private ensureTool = (toolCallId: string): ToolCallState => {
    const existing = this.tools.get(toolCallId);
    if (existing) {
      return existing;
    }
    const created = {
      toolName: toolCallId,
      rawInput: "{}",
      started: false,
      completed: false,
    };
    this.tools.set(toolCallId, created);
    return created;
  };
}

export class NarpStdioRuntimeWrapperAgent implements acp.Agent {
  private readonly sessions = new Map<string, WrapperSession>();

  constructor(
    private readonly connection: AcpConnection,
    private readonly config: NarpStdioRuntimeWrapperConfig,
  ) {}

  initialize = async (): Promise<acp.InitializeResponse> => ({
    protocolVersion: acp.PROTOCOL_VERSION,
    agentInfo: {
      name: this.config.agentName,
      version: "0.1.0",
    },
    agentCapabilities: {
      loadSession: false,
    },
  });

  newSession = async (params?: acp.NewSessionRequest): Promise<acp.NewSessionResponse> => {
    const sessionId = randomUUID();
    this.sessions.set(sessionId, {
      cwd: params?.cwd,
    });
    return { sessionId };
  };

  authenticate = async (): Promise<Record<string, never>> => ({});

  setSessionMode = async (): Promise<void> => undefined;

  unstable_setSessionModel = async (
    params: acp.SetSessionModelRequest,
  ): Promise<void> => {
    const session = this.readSession(params.sessionId);
    session.modelId = params.modelId;
  };

  prompt = async (params: acp.PromptRequest): Promise<acp.PromptResponse> => {
    const { messageId, prompt, sessionId } = params;
    const session = this.readSession(sessionId);
    const modelId = session.modelId;
    session.modelId = undefined;
    const abortController = new AbortController();
    session.abortController = abortController;

    const promptMeta = readPromptMeta(params._meta);
    const runtime = await this.config.createRuntime({
      sessionId,
      cwd: session.cwd,
      modelId,
      promptMeta,
      setSessionMetadata: (nextMetadata) =>
        this.sendSessionMetadataPatch(sessionId, nextMetadata),
    });

    await this.runRuntime({
      runtime,
      input: buildRunInput({
        sessionId,
        messageId: messageId ?? randomUUID(),
        prompt,
        promptMeta,
      }),
      abortController,
    });

    return {
      stopReason: abortController.signal.aborted ? "cancelled" : "end_turn",
      userMessageId: messageId,
    };
  };

  cancel = async (params: acp.CancelNotification): Promise<void> => {
    const session = this.sessions.get(params.sessionId);
    session?.abortController?.abort();
  };

  private runRuntime = async (params: {
    runtime: NcpAgentRuntime;
    input: NcpAgentRunInput;
    abortController: AbortController;
  }): Promise<void> => {
    const { abortController, input, runtime } = params;
    const translator = new NcpToAcpSessionUpdateTranslator();

    for await (const event of runtime.run(input, {
      signal: abortController.signal,
    })) {
      for (const update of translator.translate(event)) {
        await this.connection.sessionUpdate({
          sessionId: input.sessionId,
          update,
        });
      }
    }
  };

  private readSession = (sessionId: string): WrapperSession => {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`[narp-stdio-wrapper] session ${sessionId} not found`);
    }
    return session;
  };

  private sendSessionMetadataPatch = async (
    sessionId: string,
    nextMetadata: Record<string, unknown>,
  ): Promise<void> => {
    await this.connection.sessionUpdate({
      sessionId,
      update: {
        sessionUpdate: "session_info_update",
        _meta: {
          [NARP_STDIO_PROMPT_META_KEY]: {
            sessionMetadataPatch: nextMetadata,
          },
        },
      },
    });
  };
}

export class NarpStdioRuntimeWrapper {
  private started = false;

  constructor(private readonly config: NarpStdioRuntimeWrapperConfig) {}

  start = (): void => {
    if (this.started) {
      return;
    }
    this.started = true;
    this.bindParentLifecycle();
    const input = Writable.toWeb(process.stdout);
    const output = Readable.toWeb(process.stdin);
    const stream = acp.ndJsonStream(input, output);

    new acp.AgentSideConnection(
      (connection) => new NarpStdioRuntimeWrapperAgent(connection, this.config),
      stream,
    );
  };

  private bindParentLifecycle = (): void => {
    let shuttingDown = false;
    const shutdown = (): void => {
      if (shuttingDown) {
        return;
      }
      shuttingDown = true;
      process.exitCode = 0;
      setTimeout(() => process.exit(0), 0).unref();
    };
    process.stdin.once("end", shutdown);
    process.stdin.once("close", shutdown);
    process.once("disconnect", shutdown);
  };
}

function readPromptMeta(meta: acp.PromptRequest["_meta"]): NarpStdioPromptMeta {
  const value = meta?.[NARP_STDIO_PROMPT_META_KEY];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as NarpStdioPromptMeta;
}

function buildRunInput(params: {
  sessionId: string;
  messageId: string;
  prompt: acp.PromptRequest["prompt"];
  promptMeta: NarpStdioPromptMeta;
}): NcpAgentRunInput {
  const { messageId, prompt, promptMeta, sessionId } = params;
  return {
    sessionId,
    messages: [
      {
        id: messageId,
        sessionId,
        role: "user",
        status: "final",
        timestamp: new Date().toISOString(),
        parts: [{ type: "text", text: readPromptText(prompt) }],
      },
    ],
    ...(promptMeta.correlationId ? { correlationId: promptMeta.correlationId } : {}),
    ...(promptMeta.sessionMetadata ? { metadata: promptMeta.sessionMetadata } : {}),
  };
}

function readPromptText(prompt: acp.PromptRequest["prompt"]): string {
  const text = prompt
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("\n")
    .trim();
  return text.length > 0 ? text : "[empty message]";
}

function parseToolPayload(value: string): unknown {
  if (!value.trim()) {
    return {};
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
