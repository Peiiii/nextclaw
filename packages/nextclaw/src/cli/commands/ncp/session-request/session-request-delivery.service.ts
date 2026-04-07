import type { DefaultNcpAgentBackend } from "@nextclaw/ncp-toolkit";
import {
  NCP_INTERNAL_VISIBILITY_METADATA_KEY,
  type NcpMessage,
} from "@nextclaw/ncp";
import type {
  SessionRequestRecord,
  SessionRequestToolResult,
} from "./session-request.types.js";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function consumeAgentRun(events: AsyncIterable<unknown>): Promise<void> {
  for await (const _event of events) {
    void _event;
  }
}

function runDetached(task: Promise<void>, label: string): void {
  void task.catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[session-request] ${label} failed: ${message}`);
  });
}

function scheduleDetached(taskFactory: () => Promise<void>, label: string): void {
  setTimeout(() => {
    runDetached(taskFactory(), label);
  }, 0);
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
  const timeoutMs = params.timeoutMs ?? 15_000;
  const intervalMs = params.intervalMs ?? 150;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const summary = await params.backend.getSession(params.sessionId);
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
  const timestamp = new Date().toISOString();
  const status = params.result.status === "completed" ? "completed" : "failed";
  const responseText = params.result.finalResponseText ?? params.result.error ?? "";
  const targetKind = params.result.targetKind;
  const title = params.result.title ?? params.result.task;
  return {
    id: `${params.request.sourceSessionId}:system:session-request:${params.request.requestId}:${timestamp}`,
    sessionId: params.request.sourceSessionId,
    role: "user",
    status: "final",
    timestamp,
    parts: [
      {
        type: "text",
        text: [
          "<session-request-completion>",
          `<request-id>${escapeXml(params.request.requestId)}</request-id>`,
          `<target-session-id>${escapeXml(params.request.targetSessionId)}</target-session-id>`,
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
      session_request_id: params.request.requestId,
      target_session_id: params.request.targetSessionId,
      session_request_status: params.result.status,
    },
  };
}

export class SessionRequestDeliveryService {
  constructor(
    private readonly resolveBackend: () => DefaultNcpAgentBackend | null,
  ) {}

  publishToolResult = async (params: {
    request: SessionRequestRecord;
    result: SessionRequestToolResult;
  }): Promise<void> => {
    if (!params.request.sourceToolCallId?.trim()) {
      return;
    }
    const backend = this.resolveBackend();
    if (!backend) {
      throw new Error("NCP backend is not ready for session request delivery.");
    }
    await backend.updateToolCallResult(
      params.request.sourceSessionId,
      params.request.sourceToolCallId.trim(),
      params.result,
    );
  };

  resumeSourceSession = async (params: {
    request: SessionRequestRecord;
    result: SessionRequestToolResult;
  }): Promise<void> => {
    const backend = this.resolveBackend();
    if (!backend) {
      throw new Error("NCP backend is not ready for source session resume.");
    }
    const isIdle = await waitForSessionToBecomeIdle({
      backend,
      sessionId: params.request.sourceSessionId,
    });
    if (!isIdle) {
      console.warn(
        `[session-request] resume skipped for ${params.request.sourceSessionId} because the source session did not become idle in time.`,
      );
      return;
    }
    scheduleDetached(
      async () => consumeAgentRun(
        backend.send({
          sessionId: params.request.sourceSessionId,
          message: buildSessionRequestCompletionMessage(params),
        }),
      ),
      `resume source session ${params.request.sourceSessionId}`,
    );
  };
}
