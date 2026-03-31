import {
  stringifyUnknown,
  summarizeToolArgs,
  type ToolCard,
} from "@/lib/chat-message";
import type { ChatToolPartViewModel } from "@nextclaw/agent-chat-ui";

type ToolCardViewSource = ToolCard & {
  statusTone: ChatToolPartViewModel["statusTone"];
  statusLabel: string;
};

type SpawnToolInvocation = {
  toolName: string;
  toolCallId?: string;
  args?: unknown;
  result?: unknown;
};

type SubagentToolCardTexts = {
  toolStatusRunningLabel: string;
  toolStatusCompletedLabel: string;
  toolStatusFailedLabel: string;
};

type SubagentRunResult = {
  runId?: string;
  label?: string;
  task?: string;
  status?: string;
  result?: unknown;
  message?: string;
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

function readSubagentRunResult(value: unknown): SubagentRunResult | null {
  if (!isRecord(value)) {
    return null;
  }
  if (value.kind === "nextclaw.subagent_run") {
    return value;
  }
  if (typeof value.runId === "string" && typeof value.status === "string") {
    return value;
  }
  return null;
}

function buildSubagentDetail(subagentRun: SubagentRunResult, fallbackArgs: unknown): string | undefined {
  const detailParts = [
    readOptionalString(subagentRun.label)
      ? `label: ${subagentRun.label?.trim()}`
      : null,
    readOptionalString(subagentRun.runId)
      ? `run: ${subagentRun.runId?.trim()}`
      : null,
    readOptionalString(subagentRun.task)
      ? `task: ${subagentRun.task?.trim()}`
      : null,
  ].filter((value): value is string => Boolean(value));

  return detailParts.join(" · ") || summarizeToolArgs(fallbackArgs);
}

function buildSubagentOutput(subagentRun: SubagentRunResult): string | undefined {
  const runId = readOptionalString(subagentRun.runId);
  const label = readOptionalString(subagentRun.label);
  const task = readOptionalString(subagentRun.task);
  const status = readOptionalString(subagentRun.status)?.toLowerCase();
  const resultText =
    typeof subagentRun.result !== "undefined"
      ? stringifyUnknown(subagentRun.result).trim()
      : "";
  const messageText = readOptionalString(subagentRun.message);

  const sections = [
    runId ? `Run ID: ${runId}` : null,
    label ? `Label: ${label}` : null,
    task ? `Task:\n${task}` : null,
    resultText
      ? `${status === "failed" ? "Error" : "Result"}:\n${resultText}`
      : messageText
        ? `Status:\n${messageText}`
        : null,
  ].filter((value): value is string => Boolean(value));

  return sections.length > 0 ? sections.join("\n\n") : undefined;
}

export function buildSubagentToolCard(params: {
  invocation: SpawnToolInvocation;
  texts: SubagentToolCardTexts;
}): ToolCardViewSource | null {
  if (params.invocation.toolName !== "spawn") {
    return null;
  }

  const subagentRun = readSubagentRunResult(params.invocation.result);
  if (!subagentRun) {
    return null;
  }

  const normalizedStatus = readOptionalString(subagentRun.status)?.toLowerCase();
  const detail = buildSubagentDetail(subagentRun, params.invocation.args);
  const output = buildSubagentOutput(subagentRun);

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
  };
}
