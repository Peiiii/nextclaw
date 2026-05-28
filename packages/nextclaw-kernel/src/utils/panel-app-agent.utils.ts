import { createHash, randomUUID } from "node:crypto";
import {
  NcpEventType,
  type NcpEndpointEvent,
  type NcpMessage,
} from "@nextclaw/ncp";
import type { AgentRunSendIngressPayload } from "@nextclaw/shared";
import {
  STRUCTURED_RESULT_TOOL_NAME,
} from "@kernel/tools/structured-result.tools.js";
import {
  PanelAppError,
  type PanelAppAgentGenerateObjectInput,
  type PanelAppAgentRunClient,
  type PanelAppAgentSendPayload,
} from "@kernel/types/panel-app.types.js";

const PANEL_APP_AGENT_DEFAULT_TIMEOUT_MS = 60_000;
const PANEL_APP_AGENT_MAX_TIMEOUT_MS = 120_000;
const PANEL_APP_AGENT_MAX_PROMPT_CHARS = 20_000;
const PANEL_APP_AGENT_MAX_CONTEXT_CHARS = 80_000;

type PanelAppAgentBridgeSession = {
  panelAppId: string;
};

export type NormalizedPanelAppGenerateObjectInput =
  Required<Pick<PanelAppAgentGenerateObjectInput, "peerId" | "prompt" | "schema" | "timeoutMs">> &
  Pick<PanelAppAgentGenerateObjectInput, "context" | "title">;

export function normalizePanelAppGenerateObjectInput(
  input: PanelAppAgentGenerateObjectInput,
): NormalizedPanelAppGenerateObjectInput {
  const peerId = input.peerId.trim();
  const prompt = input.prompt.trim();
  if (!peerId || !prompt || !isRecord(input.schema)) {
    throw new PanelAppError("PANEL_APP_AGENT_REQUEST_INVALID", "invalid generateObject request");
  }
  if (prompt.length > PANEL_APP_AGENT_MAX_PROMPT_CHARS) {
    throw new PanelAppError("PANEL_APP_AGENT_REQUEST_INVALID", "generateObject prompt is too large");
  }
  const contextText = stringifyJsonValue(input.context ?? null);
  if (contextText.length > PANEL_APP_AGENT_MAX_CONTEXT_CHARS) {
    throw new PanelAppError("PANEL_APP_AGENT_REQUEST_INVALID", "generateObject context is too large");
  }
  return {
    context: input.context,
    peerId,
    prompt,
    schema: input.schema,
    timeoutMs: normalizeTimeoutMs(input.timeoutMs),
    title: input.title?.trim() || undefined,
  };
}

export function createPanelAppGenerateObjectMessage(params: {
  bridgeSession: PanelAppAgentBridgeSession;
  request: NormalizedPanelAppGenerateObjectInput;
  requestId: string;
  sessionId: string;
}): NcpMessage {
  const { bridgeSession, request, requestId, sessionId } = params;
  return {
    id: `panel-app-agent-message-${randomUUID()}`,
    metadata: {
      ...createPanelAppAgentMetadata(bridgeSession),
      panel_app_peer_id: request.peerId,
      structured_result: {
        request_id: requestId,
        schema: structuredClone(request.schema),
        tool_name: STRUCTURED_RESULT_TOOL_NAME,
      },
    },
    parts: [{
      type: "text",
      text: buildGenerateObjectPrompt(bridgeSession, request),
    }],
    role: "user",
    sessionId,
    status: "final",
    timestamp: new Date().toISOString(),
  };
}

export async function waitForPanelAppStructuredResult(
  agentRunClient: PanelAppAgentRunClient,
  params: {
    payload: AgentRunSendIngressPayload;
    timeoutMs: number;
  },
): Promise<unknown> {
  const iterator = agentRunClient
    .sendAndStreamEvents(params.payload)
    [Symbol.asyncIterator]();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new PanelAppError(
      "AGENT_OBJECT_RESULT_TIMEOUT",
      "agent object result timed out",
    )), params.timeoutMs);
  });
  let resultToolCallId: string | null = null;
  try {
    while (true) {
      const next = await Promise.race([iterator.next(), timeout]);
      if (next.done) {
        break;
      }
      const result = readStructuredResultEvent(next.value, resultToolCallId);
      if (result.matchedToolCallId) {
        resultToolCallId = result.matchedToolCallId;
      }
      if (result.submitted) {
        return result.content;
      }
      throwIfTerminalError(next.value);
    }
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    await iterator.return?.(undefined);
  }
  throw new PanelAppError(
    "AGENT_OBJECT_RESULT_NOT_SUBMITTED",
    "agent did not submit a structured object result",
  );
}

export function withPanelAppAgentMetadata(
  payload: PanelAppAgentSendPayload,
  bridgeSession: PanelAppAgentBridgeSession,
): AgentRunSendIngressPayload {
  const panelAppMetadata = createPanelAppAgentMetadata(bridgeSession);
  const metadata = {
    ...(payload.metadata ?? {}),
    ...panelAppMetadata,
  };
  if (Array.isArray(payload.content)) {
    return {
      content: structuredClone(payload.content),
      metadata,
      sessionId: payload.sessionId,
    };
  }
  if (!payload.message) {
    throw new PanelAppError("PANEL_APP_AGENT_REQUEST_INVALID", "agent send request is required");
  }
  return {
    message: {
      ...structuredClone(payload.message),
      metadata: {
        ...(payload.message.metadata ?? {}),
        ...panelAppMetadata,
      },
    },
    metadata,
    sessionId: payload.sessionId,
  };
}

export function createPanelAppAgentMetadata(
  bridgeSession: PanelAppAgentBridgeSession,
): Record<string, unknown> {
  return {
    panel_app_bridge_request_id: randomUUID(),
    panel_app_id: bridgeSession.panelAppId,
    source_kind: "panel_app",
  };
}

export function createPanelAppAgentSessionId(panelAppId: string, peerId: string): string {
  return `panel-app-agent-${createHash("sha256")
    .update(`${panelAppId}\0${peerId}`)
    .digest("hex")
    .slice(0, 32)}`;
}

function normalizeTimeoutMs(timeoutMs: number | undefined): number {
  if (!Number.isFinite(timeoutMs) || typeof timeoutMs !== "number") {
    return PANEL_APP_AGENT_DEFAULT_TIMEOUT_MS;
  }
  return Math.min(
    PANEL_APP_AGENT_MAX_TIMEOUT_MS,
    Math.max(1000, Math.trunc(timeoutMs)),
  );
}

function buildGenerateObjectPrompt(
  bridgeSession: PanelAppAgentBridgeSession,
  request: NormalizedPanelAppGenerateObjectInput,
): string {
  return [
    "Panel App generateObject request",
    "",
    `Panel App ID: ${bridgeSession.panelAppId}`,
    `Peer ID: ${request.peerId}`,
    "",
    "Context JSON:",
    stringifyJsonValue(request.context ?? null),
    "",
    "Task:",
    request.prompt,
    "",
    "Result contract:",
    `Call the ${STRUCTURED_RESULT_TOOL_NAME} tool exactly once with an object matching the provided schema.`,
    "Do not use natural language as the result.",
  ].join("\n");
}

function readStructuredResultEvent(
  event: NcpEndpointEvent,
  resultToolCallId: string | null,
): {
  matchedToolCallId?: string;
  submitted: boolean;
  content?: unknown;
} {
  if (
    event.type === NcpEventType.MessageToolCallStart &&
    event.payload.toolName === STRUCTURED_RESULT_TOOL_NAME
  ) {
    return { matchedToolCallId: event.payload.toolCallId, submitted: false };
  }
  if (
    event.type !== NcpEventType.MessageToolCallResult ||
    event.payload.toolCallId !== resultToolCallId
  ) {
    return { submitted: false };
  }
  assertToolResultContent(event.payload.content);
  return { content: event.payload.content, submitted: true };
}

function assertToolResultContent(content: unknown): void {
  if (!isRecord(content) || content.ok !== false || !isRecord(content.error)) {
    return;
  }
  const code = content.error.code;
  if (code === "invalid_tool_arguments") {
    throw new PanelAppError(
      "AGENT_OBJECT_RESULT_SCHEMA_INVALID",
      "agent object result did not match the schema",
    );
  }
  throw new PanelAppError(
    "AGENT_OBJECT_REQUEST_FAILED",
    typeof content.error.message === "string"
      ? content.error.message
      : "agent object request failed",
  );
}

function throwIfTerminalError(event: NcpEndpointEvent): void {
  if (event.type === NcpEventType.MessageFailed) {
    throw new PanelAppError("AGENT_OBJECT_REQUEST_FAILED", event.payload.error.message);
  }
  if (event.type === NcpEventType.RunError) {
    throw new PanelAppError(
      "AGENT_OBJECT_REQUEST_FAILED",
      event.payload.error ?? "agent object request failed",
    );
  }
  if (event.type === NcpEventType.RunFinished) {
    throw new PanelAppError(
      "AGENT_OBJECT_RESULT_NOT_SUBMITTED",
      "agent did not submit a structured object result",
    );
  }
}

function stringifyJsonValue(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    throw new PanelAppError("PANEL_APP_AGENT_REQUEST_INVALID", "value is not JSON serializable");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
