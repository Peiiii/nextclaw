import { estimateInputTokens } from "@nextclaw/core";
import { normalizeAssistantText } from "@nextclaw/ncp";

const SUMMARY_SOURCE_MAX_CHARS = 120_000;
const SUMMARY_SOURCE_HEAD_MESSAGES = 2;
const SUMMARY_SOURCE_TAIL_MESSAGES = 8;
const SUMMARY_HEADING = "# Compressed Working Context";
const SUMMARY_CONTINUATION_HEADING = "## Continuation Contract";
const SUMMARY_BUDGET_OMISSION = "[... context omitted to fit the checkpoint budget ...]";
const SUMMARY_SYSTEM_PROMPT = [
  "You are NextClaw's context compactor for a coding agent session.",
  "Create a complete compressed working context that will replace all prior conversation messages in a future model request.",
  "The latest active input and a token-bounded selection of real user messages may also remain raw, but the summary must still stand alone without relying on them.",
  "Preserve the active task, latest user intent, latest assistant response, tool results, and recent turns with high fidelity inside the summary.",
  "Always include a 'Continuation Contract' section that states what the next assistant response should remember and how it should continue the session.",
  "Do not turn missing user profile, assistant nickname, or onboarding fields into blockers unless onboarding is the active user task in the latest turns.",
  "If the latest user message is a short greeting, preserve the prior active task and last assistant stance so the next response does not restart as a fresh session.",
  "Preserve user goals, explicit instructions, decisions, files touched or inspected, code changes, commands run, test results, failures, blockers, current task state, and exact next steps.",
  "Do not invent facts. If something is uncertain, mark it as uncertain.",
  "Return Markdown only. Start with '# Compressed Working Context'.",
].join("\n");

function toCompactionSourceMessage(message: Record<string, unknown>): Record<string, unknown> {
  return {
    role: message.role,
    content: message.content,
    timestamp: message.timestamp,
    ncp_message_id: message.ncp_message_id,
  };
}

function truncateSummarySourceString(value: unknown, maxChars: number): unknown {
  if (typeof value !== "string" || value.length <= maxChars) {
    return value;
  }
  const marker = `[${value.length - maxChars} chars omitted]`;
  const headChars = Math.floor((maxChars - marker.length) / 2);
  const tailChars = maxChars - marker.length - headChars;
  return [
    value.slice(0, headChars).trimEnd(),
    marker,
    value.slice(-tailChars).trimStart(),
  ].join("\n");
}

function stringifyCompactionSource(
  messages: readonly Record<string, unknown>[],
  maxChars: number,
): string {
  const sourceMessages = messages.map(toCompactionSourceMessage);
  const json = JSON.stringify(sourceMessages, null, 2);
  if (json.length <= maxChars) {
    return json;
  }
  const tailStart = Math.max(
    SUMMARY_SOURCE_HEAD_MESSAGES,
    sourceMessages.length - SUMMARY_SOURCE_TAIL_MESSAGES,
  );
  const compactedMessages = [
    ...sourceMessages.slice(0, SUMMARY_SOURCE_HEAD_MESSAGES),
    ...(tailStart > SUMMARY_SOURCE_HEAD_MESSAGES
      ? [{
          role: "system",
          content: `[${tailStart - SUMMARY_SOURCE_HEAD_MESSAGES} middle messages omitted from compaction source]`,
        }]
      : []),
    ...sourceMessages.slice(tailStart),
  ];
  const maxStringChars = Math.max(
    256,
    Math.floor(maxChars / Math.max(1, compactedMessages.length) * 0.7),
  );
  const compactedJson = JSON.stringify(
    compactedMessages,
    (_key, value) => truncateSummarySourceString(value, maxStringChars),
    2,
  );
  if (compactedJson.length <= maxChars) {
    return compactedJson;
  }
  const marker = "\n[truncated_compaction_source_middle]\n";
  if (maxChars <= marker.length) {
    return compactedJson.slice(0, maxChars);
  }
  const headChars = Math.floor((maxChars - marker.length) / 2);
  const tailChars = maxChars - marker.length - headChars;
  return `${compactedJson.slice(0, headChars).trimEnd()}${marker}${compactedJson.slice(-tailChars).trimStart()}`;
}

function buildSummaryProviderMessages(params: {
  messages: readonly Record<string, unknown>[];
  sourceMaxChars: number;
  targetSummaryTokens: number;
}): Record<string, unknown>[] {
  const { messages, sourceMaxChars, targetSummaryTokens } = params;
  return [
    { role: "system", content: SUMMARY_SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        "Compress these runtime messages into a reusable working context.",
        `Keep the visible Markdown summary within ${targetSummaryTokens} tokens. Use the output budget for the summary, not for hidden reasoning.`,
        "Include a 'Recent High-Fidelity Context' section for the latest important user/assistant turns.",
        "Include a 'Continuation Contract' section after the recent context.",
        "",
        "Messages JSON:",
        stringifyCompactionSource(messages, sourceMaxChars),
      ].join("\n"),
    },
  ];
}

export function fitContextCompactionSummaryInput(params: {
  maxInputTokens: number;
  messages: readonly Record<string, unknown>[];
  targetSummaryTokens: number;
}): Record<string, unknown>[] {
  const { maxInputTokens, messages, targetSummaryTokens } = params;
  let lower = 0;
  let upper = SUMMARY_SOURCE_MAX_CHARS;
  let fitted = buildSummaryProviderMessages({ messages: [], sourceMaxChars: 0, targetSummaryTokens });
  if (estimateInputTokens(fitted) > maxInputTokens) {
    throw new Error(
      `Context compaction summary prompt needs more than ${maxInputTokens} input tokens. Increase the agent contextTokens setting.`,
    );
  }
  while (lower <= upper) {
    const sourceMaxChars = Math.floor((lower + upper) / 2);
    const candidate = buildSummaryProviderMessages({ messages, sourceMaxChars, targetSummaryTokens });
    if (estimateInputTokens(candidate) <= maxInputTokens) {
      fitted = candidate;
      lower = sourceMaxChars + 1;
    } else {
      upper = sourceMaxChars - 1;
    }
  }
  return fitted;
}

export function normalizeContextCompactionSummary(content: string): string {
  return normalizeAssistantText(content, "think-tags").text.trim();
}

function truncateSummarySegment(text: string, retainedChars: number): string {
  if (text.length <= retainedChars) {
    return text;
  }
  if (retainedChars <= 0) {
    return SUMMARY_BUDGET_OMISSION;
  }
  const headChars = Math.ceil(retainedChars / 2);
  const tailChars = retainedChars - headChars;
  return [
    text.slice(0, headChars).trimEnd(),
    SUMMARY_BUDGET_OMISSION,
    tailChars > 0 ? text.slice(-tailChars).trimStart() : "",
  ].filter(Boolean).join("\n\n");
}

function buildFittedSummary(params: {
  continuationBody: string;
  preContinuationBody: string;
  retainedChars: number;
}): string {
  const { continuationBody, preContinuationBody, retainedChars } = params;
  const minimumContinuationChars = Math.min(96, continuationBody.length);
  let continuationChars = Math.min(
    continuationBody.length,
    Math.max(minimumContinuationChars, Math.floor(retainedChars * 0.35)),
    retainedChars,
  );
  let preContinuationChars = Math.min(
    preContinuationBody.length,
    Math.max(0, retainedChars - continuationChars),
  );
  continuationChars = Math.min(
    continuationBody.length,
    continuationChars + Math.max(0, retainedChars - continuationChars - preContinuationChars),
  );
  preContinuationChars = Math.min(
    preContinuationBody.length,
    preContinuationChars + Math.max(0, retainedChars - continuationChars - preContinuationChars),
  );
  return [
    SUMMARY_HEADING,
    truncateSummarySegment(preContinuationBody, preContinuationChars),
    SUMMARY_CONTINUATION_HEADING,
    truncateSummarySegment(continuationBody, continuationChars),
  ].join("\n\n");
}

export function fitContextCompactionSummaryOutput(params: {
  maxInstallableSummaryTokens: number;
  summary: string;
}): string | null {
  const { maxInstallableSummaryTokens, summary } = params;
  if (estimateInputTokens(summary) <= maxInstallableSummaryTokens) {
    return summary;
  }
  const continuationIndex = summary.indexOf(SUMMARY_CONTINUATION_HEADING);
  if (!summary.startsWith(SUMMARY_HEADING) || continuationIndex < 0) {
    return null;
  }
  const preContinuationBody = summary
    .slice(SUMMARY_HEADING.length, continuationIndex)
    .trim();
  const continuationBody = summary
    .slice(continuationIndex + SUMMARY_CONTINUATION_HEADING.length)
    .trim();
  let lower = 0;
  let upper = preContinuationBody.length + continuationBody.length;
  let fitted = buildFittedSummary({
    continuationBody,
    preContinuationBody,
    retainedChars: 0,
  });
  if (estimateInputTokens(fitted) > maxInstallableSummaryTokens) {
    return null;
  }
  while (lower <= upper) {
    const retainedChars = Math.floor((lower + upper) / 2);
    const candidate = buildFittedSummary({
      continuationBody,
      preContinuationBody,
      retainedChars,
    });
    if (estimateInputTokens(candidate) <= maxInstallableSummaryTokens) {
      fitted = candidate;
      lower = retainedChars + 1;
    } else {
      upper = retainedChars - 1;
    }
  }
  return fitted;
}
