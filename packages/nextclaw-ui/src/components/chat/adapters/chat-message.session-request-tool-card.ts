import {
  stringifyUnknown,
  summarizeToolArgs,
  type ToolCard,
} from "@/lib/chat-message";
import type { ChatToolPartViewModel } from "@nextclaw/agent-chat-ui";

type ToolCardViewSource = ToolCard & {
  statusTone: ChatToolPartViewModel["statusTone"];
  statusLabel: string;
  action?: ChatToolPartViewModel["action"];
};

type SessionRequestInvocation = {
  toolName: string;
  toolCallId?: string;
  args?: unknown;
  result?: unknown;
};

type SessionRequestToolCardTexts = {
  toolStatusRunningLabel: string;
  toolStatusCompletedLabel: string;
  toolStatusFailedLabel: string;
};

type SessionRequestResult = {
  kind: string;
  requestId?: string;
  sessionId?: string;
  isChildSession?: boolean;
  title?: string;
  task?: string;
  status?: string;
  message?: unknown;
  finalResponseText?: unknown;
  error?: unknown;
  parentSessionId?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readSessionRequestResult(value: unknown): SessionRequestResult | null {
  if (!isRecord(value) || value.kind !== "nextclaw.session_request") {
    return null;
  }
  return value as SessionRequestResult;
}

function buildSessionRequestDetail(
  result: SessionRequestResult,
  fallbackArgs: unknown,
): string | undefined {
  const detailParts = [
    readOptionalString(result.title)
      ? `title: ${result.title?.trim()}`
      : null,
    readOptionalString(result.sessionId)
      ? `session: ${result.sessionId?.trim()}`
      : null,
    readOptionalString(result.task)
      ? `task: ${result.task?.trim()}`
      : null,
  ].filter((value): value is string => Boolean(value));

  return detailParts.join(" · ") || summarizeToolArgs(fallbackArgs);
}

function buildSessionRequestOutput(result: SessionRequestResult): string | undefined {
  const requestId = readOptionalString(result.requestId);
  const sessionId = readOptionalString(result.sessionId);
  const title = readOptionalString(result.title);
  const task = readOptionalString(result.task);
  const messageText =
    typeof result.message !== "undefined"
      ? stringifyUnknown(result.message).trim()
      : "";
  const finalResponseText =
    typeof result.finalResponseText !== "undefined"
      ? stringifyUnknown(result.finalResponseText).trim()
      : "";
  const errorText =
    typeof result.error !== "undefined"
      ? stringifyUnknown(result.error).trim()
      : "";

  const sections = [
    requestId ? `Request ID: ${requestId}` : null,
    sessionId ? `Session ID: ${sessionId}` : null,
    typeof result.isChildSession === "boolean"
      ? `Target: ${result.isChildSession ? "child" : "session"}`
      : null,
    title ? `Title: ${title}` : null,
    task ? `Task:\n${task}` : null,
    finalResponseText
      ? `Final Response:\n${finalResponseText}`
      : errorText
        ? `Error:\n${errorText}`
        : messageText
          ? `Status:\n${messageText}`
        : null,
  ].filter((value): value is string => Boolean(value));

  return sections.length > 0 ? sections.join("\n\n") : undefined;
}

export function buildSessionRequestToolCard(params: {
  invocation: SessionRequestInvocation;
  texts: SessionRequestToolCardTexts;
}): ToolCardViewSource | null {
  if (
    params.invocation.toolName !== "spawn" &&
    params.invocation.toolName !== "sessions_request"
  ) {
    return null;
  }

  const sessionRequest = readSessionRequestResult(params.invocation.result);
  if (!sessionRequest) {
    return null;
  }

  const normalizedStatus = readOptionalString(sessionRequest.status)?.toLowerCase();
  const detail = buildSessionRequestDetail(sessionRequest, params.invocation.args);
  const output = buildSessionRequestOutput(sessionRequest);
  const targetSessionId = readOptionalString(sessionRequest.sessionId);
  const action =
    targetSessionId
      ? {
          kind: "open-session" as const,
          sessionId: targetSessionId,
          sessionKind: sessionRequest.isChildSession === true ? ("child" as const) : ("session" as const),
          ...(readOptionalString(sessionRequest.title)
            ? { label: sessionRequest.title!.trim() }
            : {}),
          ...(readOptionalString(sessionRequest.parentSessionId)
            ? { parentSessionId: sessionRequest.parentSessionId!.trim() }
            : {}),
        }
      : undefined;

  if (normalizedStatus === "failed") {
    return {
      kind: "result",
      name: params.invocation.toolName,
      detail,
      text: output,
      callId: params.invocation.toolCallId || undefined,
      hasResult: Boolean(output),
      statusTone: "error",
      statusLabel: params.texts.toolStatusFailedLabel,
      ...(action ? { action } : {}),
    };
  }

  if (normalizedStatus === "completed") {
    return {
      kind: "result",
      name: params.invocation.toolName,
      detail,
      text: output,
      callId: params.invocation.toolCallId || undefined,
      hasResult: Boolean(output),
      statusTone: "success",
      statusLabel: params.texts.toolStatusCompletedLabel,
      ...(action ? { action } : {}),
    };
  }

  return {
    kind: "result",
    name: params.invocation.toolName,
    detail,
    text: output,
    callId: params.invocation.toolCallId || undefined,
    hasResult: Boolean(output),
    statusTone: "running",
    statusLabel: params.texts.toolStatusRunningLabel,
    ...(action ? { action } : {}),
  };
}
