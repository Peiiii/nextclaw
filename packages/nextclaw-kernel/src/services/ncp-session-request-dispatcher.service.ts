import {
  NCP_INTERNAL_VISIBILITY_METADATA_KEY,
  NcpEventType,
  type NcpCompletedEnvelope,
  type NcpMessage,
} from "@nextclaw/ncp";
import type { DefaultNcpAgentBackend } from "@nextclaw/ncp-toolkit";
import type {
  SessionRequestDispatcher,
  SessionRequestDispatchResult,
  SessionRequestRecord,
  SessionRequestToolResult,
} from "@nextclaw/core";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildSessionRequestUserMessage(params: {
  sessionId: string;
  requestId: string;
  task: string;
}): NcpMessage {
  const { sessionId, requestId, task } = params;
  const timestamp = new Date().toISOString();
  return {
    id: `${sessionId}:user:session-request:${requestId}`,
    sessionId,
    role: "user",
    status: "final",
    timestamp,
    parts: [{ type: "text", text: task }],
    metadata: {
      session_request_id: requestId,
    },
  };
}

function extractSessionMessageText(
  message: NcpMessage | undefined,
): string | undefined {
  const parts = (message?.parts ?? [])
    .flatMap((part) => part.type === "text" || part.type === "rich-text" ? [part.text] : [])
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return parts.length > 0 ? parts.join("\n\n") : undefined;
}

async function consumeAgentRun(events: AsyncIterable<unknown>): Promise<void> {
  for await (const _event of events) {
    void _event;
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSessionToBecomeIdle(params: {
  backend: Pick<DefaultNcpAgentBackend, "getSession">;
  sessionId: string;
  timeoutMs?: number;
  intervalMs?: number;
}): Promise<boolean> {
  const {
    backend,
    intervalMs = 150,
    sessionId,
    timeoutMs = 15_000,
  } = params;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const summary = await backend.getSession(sessionId);
    if (!summary) {
      return false;
    }
    if (summary.status !== "running") {
      return true;
    }
    await sleep(intervalMs);
  }

  return false;
}

function buildSessionRequestCompletionMessage(params: {
  request: SessionRequestRecord;
  result: SessionRequestToolResult;
}): NcpMessage {
  const { request, result } = params;
  const timestamp = new Date().toISOString();
  const status = result.status === "completed" ? "completed" : "failed";
  const responseText = result.finalResponseText ?? result.error ?? "";
  const targetKind = result.targetKind;
  const title = result.title ?? result.task;
  return {
    id: `${request.sourceSessionId}:system:session-request:${request.requestId}:${timestamp}`,
    sessionId: request.sourceSessionId,
    role: "user",
    status: "final",
    timestamp,
    parts: [
      {
        type: "text",
        text: [
          "<session-request-completion>",
          `<request-id>${escapeXml(request.requestId)}</request-id>`,
          `<target-session-id>${escapeXml(request.targetSessionId)}</target-session-id>`,
          `<target-kind>${escapeXml(targetKind)}</target-kind>`,
          `<title>${escapeXml(title)}</title>`,
          `<status>${escapeXml(status)}</status>`,
          `<final-response>${escapeXml(responseText)}</final-response>`,
          "<instructions>This is an internal delegated session completion notification. Continue the current task using this result. Do not mention this hidden notification unless the user explicitly asks about internal behavior.</instructions>",
          "</session-request-completion>",
        ].join("\n"),
      },
    ],
    metadata: {
      [NCP_INTERNAL_VISIBILITY_METADATA_KEY]: "hidden",
      system_event_kind: "session_request_completion",
      session_request_id: request.requestId,
      target_session_id: request.targetSessionId,
      session_request_status: result.status,
    },
  };
}

export class NcpSessionRequestDispatcher implements SessionRequestDispatcher {
  constructor(
    private readonly resolveBackend: () => DefaultNcpAgentBackend | null,
  ) {}

  private requireBackend = (capability: string): DefaultNcpAgentBackend => {
    const backend = this.resolveBackend();
    if (!backend) {
      throw new Error(`NCP backend is not ready for ${capability}.`);
    }
    return backend;
  };

  getSession = async (sessionId: string) => {
    return this.requireBackend("session requests").getSession(sessionId);
  };

  dispatch = async (params: {
    request: SessionRequestRecord;
    task: string;
    onAccepted: (messageId: string) => void;
  }): Promise<SessionRequestDispatchResult> => {
    const completedMessage = await this.readCompletedMessageFromStream({
      backend: this.requireBackend("session request execution"),
      ...params,
    });
    if (!completedMessage) {
      throw new Error("Session request completed without a final reply.");
    }
    return {
      finalResponseMessageId: completedMessage.id,
      finalResponseText: extractSessionMessageText(completedMessage),
    };
  };

  publishOutcome = async (params: {
    request: SessionRequestRecord;
    result: SessionRequestToolResult;
  }): Promise<void> => {
    const { request, result } = params;
    const sourceToolCallId = request.sourceToolCallId?.trim();
    if (sourceToolCallId) {
      await this.requireBackend("session request delivery").updateToolCallResult(
        request.sourceSessionId,
        sourceToolCallId,
        result,
      );
    }
    if (params.request.notify !== "final_reply") {
      return;
    }
    await this.notifySourceSession(params);
  };

  private readCompletedMessageFromStream = async (params: {
    backend: DefaultNcpAgentBackend;
    request: SessionRequestRecord;
    task: string;
    onAccepted: (messageId: string) => void;
  }): Promise<NcpCompletedEnvelope["message"] | undefined> => {
    const { backend, onAccepted, request, task } = params;
    let completedMessage: NcpCompletedEnvelope["message"] | undefined;
    const message = buildSessionRequestUserMessage({
      sessionId: request.targetSessionId,
      requestId: request.requestId,
      task,
    });
    for await (const event of backend.send({
      sessionId: request.targetSessionId,
      message,
    })) {
      if (event.type === NcpEventType.MessageAccepted) {
        onAccepted(event.payload.messageId);
        continue;
      }
      if (event.type === NcpEventType.MessageFailed) {
        throw new Error(event.payload.error.message);
      }
      if (event.type === NcpEventType.RunError) {
        throw new Error(event.payload.error ?? "Session request failed.");
      }
      if (event.type === NcpEventType.MessageCompleted) {
        completedMessage = event.payload.message;
      }
    }
    return completedMessage;
  };

  private notifySourceSession = async (params: {
    request: SessionRequestRecord;
    result: SessionRequestToolResult;
  }): Promise<void> => {
    const backend = this.requireBackend("session-request notifications");
    const isIdle = await waitForSessionToBecomeIdle({
      backend,
      sessionId: params.request.sourceSessionId,
    });
    if (!isIdle) {
      console.warn(
        `[session-request] notify skipped for ${params.request.sourceSessionId} because the source session did not become idle in time.`,
      );
      return;
    }
    void consumeAgentRun(
      backend.send({
        sessionId: params.request.sourceSessionId,
        message: buildSessionRequestCompletionMessage(params),
      }),
    ).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[session-request] notify source session ${params.request.sourceSessionId} failed: ${message}`);
    });
  };
}
