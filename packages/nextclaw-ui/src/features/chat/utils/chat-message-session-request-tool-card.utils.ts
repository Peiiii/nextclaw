import {
  stringifyUnknown,
  summarizeToolArgs,
  type ToolCard,
} from "@/lib/chat-message";
import { resolveToolInvocationAgentId } from "./chat-message-tool-agent-id.utils";
import type { ChatToolPartViewModel } from "@nextclaw/agent-chat-ui";

type ToolCardViewSource = ToolCard & {
  statusTone: ChatToolPartViewModel["statusTone"];
  statusLabel: string;
  input?: string;
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
  agentId?: string;
  isChildSession?: boolean;
  lifecycle?: string;
  title?: string;
  task?: string;
  status?: string;
  notify?: string;
  spawnedByRequestId?: string;
  message?: unknown;
  finalResponseText?: unknown;
  error?: unknown;
  parentSessionId?: string;
};

type SessionSpawnResult = {
  kind: string;
  sessionId?: string;
  agentId?: string;
  isChildSession?: boolean;
  title?: string;
  sessionType?: string;
  lifecycle?: string;
  createdAt?: string;
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

function readSessionSpawnResult(value: unknown): SessionSpawnResult | null {
  if (!isRecord(value) || value.kind !== "nextclaw.session") {
    return null;
  }
  return value as SessionSpawnResult;
}

function parseStructuredValue(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return value;
  }
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

function buildStructuredInput(value: unknown): string | undefined {
  const text = stringifyUnknown(parseStructuredValue(value)).trim();
  return text || undefined;
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

function buildSessionSpawnDetail(
  result: SessionSpawnResult,
  fallbackArgs: unknown,
): string | undefined {
  const detailParts = [
    readOptionalString(result.title)
      ? `title: ${result.title?.trim()}`
      : null,
    readOptionalString(result.sessionId)
      ? `session: ${result.sessionId?.trim()}`
      : null,
  ].filter((value): value is string => Boolean(value));

  return detailParts.join(" · ") || summarizeToolArgs(fallbackArgs);
}

function buildSessionRequestOutput(result: SessionRequestResult): string | undefined {
  const requestId = readOptionalString(result.requestId);
  const sessionId = readOptionalString(result.sessionId);
  const title = readOptionalString(result.title);
  const task = readOptionalString(result.task);
  const status = readOptionalString(result.status);
  const notify = readOptionalString(result.notify);
  const lifecycle = readOptionalString(result.lifecycle);
  const parentSessionId = readOptionalString(result.parentSessionId);
  const spawnedByRequestId = readOptionalString(result.spawnedByRequestId);
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
    status ? `Status: ${status}` : null,
    notify ? `Notify: ${notify}` : null,
    lifecycle ? `Lifecycle: ${lifecycle}` : null,
    parentSessionId ? `Parent Session ID: ${parentSessionId}` : null,
    spawnedByRequestId ? `Spawned By Request ID: ${spawnedByRequestId}` : null,
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

function buildSessionSpawnOutput(result: SessionSpawnResult): string | undefined {
  const sessionId = readOptionalString(result.sessionId);
  const title = readOptionalString(result.title);
  const sessionType = readOptionalString(result.sessionType);
  const lifecycle = readOptionalString(result.lifecycle);
  const parentSessionId = readOptionalString(result.parentSessionId);
  const createdAt = readOptionalString(result.createdAt);

  const sections = [
    sessionId ? `Session ID: ${sessionId}` : null,
    typeof result.isChildSession === "boolean"
      ? `Target: ${result.isChildSession ? "child" : "session"}`
      : null,
    title ? `Title: ${title}` : null,
    sessionType ? `Session Type: ${sessionType}` : null,
    lifecycle ? `Lifecycle: ${lifecycle}` : null,
    parentSessionId ? `Parent Session ID: ${parentSessionId}` : null,
    createdAt ? `Created At: ${createdAt}` : null,
  ].filter((value): value is string => Boolean(value));

  return sections.length > 0 ? sections.join("\n\n") : undefined;
}

export function buildSessionRequestToolCard(params: {
  invocation: SessionRequestInvocation;
  texts: SessionRequestToolCardTexts;
}): ToolCardViewSource | null {
  const { invocation, texts } = params;
  const { toolName, toolCallId, args, result } = invocation;

  if (
    toolName !== "spawn" &&
    toolName !== "sessions_request" &&
    toolName !== "sessions_spawn"
  ) {
    return null;
  }

  const sessionRequest = readSessionRequestResult(result);
  if (sessionRequest) {
    const normalizedStatus = readOptionalString(sessionRequest.status)?.toLowerCase();
    const detail = buildSessionRequestDetail(sessionRequest, args);
    const output = buildSessionRequestOutput(sessionRequest);
    const targetSessionId = readOptionalString(sessionRequest.sessionId);
    const agentId = resolveToolInvocationAgentId({ args, result: sessionRequest });
    const action =
      targetSessionId
        ? {
            kind: "open-session" as const,
            sessionId: targetSessionId,
            sessionKind: sessionRequest.isChildSession === true ? ("child" as const) : ("session" as const),
            ...(agentId
              ? { agentId }
              : {}),
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
        name: toolName,
        detail,
        input: buildStructuredInput(args),
        text: output,
        callId: toolCallId || undefined,
        hasResult: Boolean(output),
        statusTone: "error",
        statusLabel: texts.toolStatusFailedLabel,
        ...(agentId ? { agentId } : {}),
        ...(action ? { action } : {}),
      };
    }

    if (normalizedStatus === "completed") {
      return {
        kind: "result",
        name: toolName,
        detail,
        input: buildStructuredInput(args),
        text: output,
        callId: toolCallId || undefined,
        hasResult: Boolean(output),
        statusTone: "success",
        statusLabel: texts.toolStatusCompletedLabel,
        ...(agentId ? { agentId } : {}),
        ...(action ? { action } : {}),
      };
    }

    return {
      kind: "result",
      name: toolName,
      detail,
      input: buildStructuredInput(args),
      text: output,
      callId: toolCallId || undefined,
      hasResult: Boolean(output),
      statusTone: "running",
      statusLabel: texts.toolStatusRunningLabel,
      ...(agentId ? { agentId } : {}),
      ...(action ? { action } : {}),
    };
  }

  const sessionSpawn = readSessionSpawnResult(result);
  if (!sessionSpawn) {
    return null;
  }

  const detail = buildSessionSpawnDetail(sessionSpawn, args);
  const output = buildSessionSpawnOutput(sessionSpawn);
  const targetSessionId = readOptionalString(sessionSpawn.sessionId);
  const agentId = resolveToolInvocationAgentId({ args, result: sessionSpawn });
  const action =
    targetSessionId
      ? {
          kind: "open-session" as const,
          sessionId: targetSessionId,
          sessionKind: sessionSpawn.isChildSession === true ? ("child" as const) : ("session" as const),
          ...(agentId
            ? { agentId }
            : {}),
          ...(readOptionalString(sessionSpawn.title)
            ? { label: sessionSpawn.title!.trim() }
            : {}),
          ...(readOptionalString(sessionSpawn.parentSessionId)
            ? { parentSessionId: sessionSpawn.parentSessionId!.trim() }
            : {}),
        }
      : undefined;

  return {
    kind: "result",
    name: toolName,
    detail,
    input: buildStructuredInput(args),
    text: output,
    callId: toolCallId || undefined,
    hasResult: Boolean(output),
    statusTone: "success",
    statusLabel: texts.toolStatusCompletedLabel,
    ...(agentId ? { agentId } : {}),
    ...(action ? { action } : {}),
  };
}
