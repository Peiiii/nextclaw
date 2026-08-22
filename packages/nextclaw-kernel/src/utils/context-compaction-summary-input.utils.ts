import { estimateInputTokens } from "@nextclaw/core";
import { normalizeAssistantText } from "@nextclaw/ncp";

const SUMMARY_SOURCE_MAX_CHARS = 120_000;
const SUMMARY_SOURCE_HEAD_MESSAGES = 2;
const SUMMARY_SOURCE_TAIL_MESSAGES = 8;
const SUMMARY_HEADING = "# Compressed Working Context";
export const SUMMARY_CONTINUATION_HEADING = "## Continuation Contract";
export const SUMMARY_ESSENTIAL_COMPLETE_MARKER = "<!-- nextclaw-essential-context-complete -->";
const SUMMARY_ESSENTIAL_SECTIONS = [
  "Active Request",
  "Current Work State",
  "Safety and User Constraints",
  "Continuation Contract",
] as const;
const SUMMARY_OPTIONAL_SECTIONS = [
  ["Critical Technical Context", "critical-technical-context"],
  ["Evidence and Verification", "evidence-and-verification"],
  ["Recent High-Fidelity Context", "recent-high-fidelity-context"],
  ["Older Relevant Context", "older-relevant-context"],
] as const;
const SUMMARY_SYSTEM_PROMPT = [
  "Compress a coding-agent session into standalone Markdown. Do not invent facts.",
  "Start with '# Compressed Working Context'. Then use these sections in exact order: Active Request; Current Work State; Safety and User Constraints; Continuation Contract; Critical Technical Context; Evidence and Verification; Recent High-Fidelity Context; Older Relevant Context.",
  "The first four sections are essential and must have non-empty bodies. End the Continuation Contract body with exactly '<!-- nextclaw-essential-context-complete -->'. Put no text after that marker before the next heading.",
  "Optional sections follow in the listed order. End each body with '<!-- nextclaw-section-complete:SLUG -->', using slugs critical-technical-context, evidence-and-verification, recent-high-fidelity-context, and older-relevant-context. Omit an optional section unless you can close it.",
  "Keep all essential facts in the first four sections: latest user intent, active task, current work, constraints, decisions, files and changes, tool/test evidence, failures, blockers, and exact next step.",
  "Do not restart onboarding for missing profile fields unless onboarding is the active task. A greeting does not erase the prior task.",
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
  essentialOnly: boolean;
  messages: readonly Record<string, unknown>[];
  sourceMaxChars: number;
  targetSummaryTokens: number;
}): Record<string, unknown>[] {
  const { essentialOnly, messages, sourceMaxChars, targetSummaryTokens } = params;
  return [
    {
      role: "system",
      content: essentialOnly
        ? `${SUMMARY_SYSTEM_PROMPT}\nThis is the final recovery attempt. Stop immediately after the essential completion marker and do not output optional sections.`
        : SUMMARY_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: [
        "Compress these runtime messages into a reusable working context.",
        `Keep the visible Markdown summary within ${targetSummaryTokens} tokens. Use the output budget for the summary, not for hidden reasoning.`,
        essentialOnly
          ? "Output the four essential sections only, then stop after the essential completion marker."
          : "Complete the essential prefix first; add only optional sections you can close.",
        "",
        "Messages JSON:",
        stringifyCompactionSource(messages, sourceMaxChars),
      ].join("\n"),
    },
  ];
}

export function fitContextCompactionSummaryInput(params: {
  essentialOnly?: boolean;
  maxInputTokens: number;
  messages: readonly Record<string, unknown>[];
  targetSummaryTokens: number;
  sourceMaxChars?: number;
}): Record<string, unknown>[] {
  const {
    essentialOnly = false,
    maxInputTokens,
    messages,
    sourceMaxChars = SUMMARY_SOURCE_MAX_CHARS,
    targetSummaryTokens,
  } = params;
  let lower = 0;
  let upper = Math.max(0, sourceMaxChars);
  let fitted = buildSummaryProviderMessages({
    essentialOnly,
    messages: [],
    sourceMaxChars: 0,
    targetSummaryTokens,
  });
  if (estimateInputTokens(fitted) > maxInputTokens) {
    throw new Error(
      `Context compaction summary prompt needs more than ${maxInputTokens} input tokens. Increase the agent contextTokens setting.`,
    );
  }
  while (lower <= upper) {
    const sourceMaxChars = Math.floor((lower + upper) / 2);
    const candidate = buildSummaryProviderMessages({
      essentialOnly,
      messages,
      sourceMaxChars,
      targetSummaryTokens,
    });
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

type ParsedSummarySection = {
  heading: string;
  body: string;
  complete: boolean;
  marker: string;
};

export type ContextCompactionSummaryValidation = {
  essentialComplete: boolean;
  missingEssentialSections: string[];
  summary: string | null;
};

function parseSummarySections(summary: string): ParsedSummarySection[] | null {
  if (!summary.startsWith(SUMMARY_HEADING)) {
    return null;
  }
  const headingPattern = /^## ([^\n]+)$/gm;
  const headings = [...summary.matchAll(headingPattern)];
  if (headings.length === 0) {
    return null;
  }
  return headings.map((headingMatch, index) => {
    const heading = headingMatch[1]?.trim() ?? "";
    const start = (headingMatch.index ?? 0) + headingMatch[0].length;
    const end = headings[index + 1]?.index ?? summary.length;
    const body = summary.slice(start, end).trim();
    const optional = SUMMARY_OPTIONAL_SECTIONS.find(([name]) => name === heading);
    const marker = heading === SUMMARY_CONTINUATION_HEADING.slice(3)
      ? SUMMARY_ESSENTIAL_COMPLETE_MARKER
      : optional
        ? `<!-- nextclaw-section-complete:${optional[1]} -->`
        : "";
    const complete = optional
      ? body.endsWith(marker)
      : heading === SUMMARY_CONTINUATION_HEADING.slice(3)
        ? body.endsWith(marker)
        : Boolean(body);
    return {
      heading,
      body,
      complete,
      marker,
    };
  });
}

/**
 * Validate the priority-prefix protocol and return only complete sections.
 * A truncated optional tail is deliberately discarded as a unit.
 */
export function validateContextCompactionSummary(params: {
  summary: string;
}): ContextCompactionSummaryValidation {
  const essentialMarkerCount = params.summary.split(SUMMARY_ESSENTIAL_COMPLETE_MARKER).length - 1;
  if (essentialMarkerCount !== 1) {
    return {
      essentialComplete: false,
      missingEssentialSections: ["Continuation Contract"],
      summary: null,
    };
  }
  const sections = parseSummarySections(params.summary);
  if (!sections) {
    return {
      essentialComplete: false,
      missingEssentialSections: [...SUMMARY_ESSENTIAL_SECTIONS],
      summary: null,
    };
  }
  const required = sections.slice(0, SUMMARY_ESSENTIAL_SECTIONS.length);
  const missingEssentialSections = SUMMARY_ESSENTIAL_SECTIONS.filter((heading, index) => {
    const section = required[index];
    return section?.heading !== heading || !section.body || !section.complete;
  });
  if (missingEssentialSections.length > 0) {
    return { essentialComplete: false, missingEssentialSections, summary: null };
  }

  const retained: string[] = [
    SUMMARY_HEADING,
    ...required.map((section) => `## ${section.heading}\n\n${section.body}`),
  ];
  const optionalStart = SUMMARY_ESSENTIAL_SECTIONS.length;
  for (let index = optionalStart; index < sections.length; index += 1) {
    const section = sections[index];
    const expectedOptional = SUMMARY_OPTIONAL_SECTIONS[index - optionalStart];
    if (
      !section ||
      !section.marker ||
      !section.complete ||
      !expectedOptional ||
      section.heading !== expectedOptional[0]
    ) {
      break;
    }
    retained.push(`## ${section.heading}\n\n${section.body}`);
  }
  return {
    essentialComplete: true,
    missingEssentialSections: [],
    summary: retained.join("\n\n"),
  };
}

export function fitContextCompactionSummaryOutput(params: {
  maxInstallableSummaryTokens: number;
  summary: string;
}): string | null {
  const { maxInstallableSummaryTokens, summary } = params;
  const validation = validateContextCompactionSummary({ summary });
  if (!validation.summary) {
    return null;
  }
  const fittedSummary = validation.summary;
  if (estimateInputTokens(fittedSummary) <= maxInstallableSummaryTokens) {
    return fittedSummary;
  }
  const sections = parseSummarySections(fittedSummary);
  if (!sections) {
    return null;
  }
  const essentialSections = sections.slice(0, SUMMARY_ESSENTIAL_SECTIONS.length);
  const composeEssential = (): string => [
    SUMMARY_HEADING,
    ...essentialSections.map((section) => `## ${section.heading}\n\n${section.body}`),
  ].join("\n\n");

  // Optional sections are a lower-priority tail: discard them before touching
  // the essential prefix. This is the normal hard-budget path for a length
  // response that completed the required protocol.
  const essentialOnly = composeEssential();
  if (estimateInputTokens(essentialOnly) <= maxInstallableSummaryTokens) {
    return essentialOnly;
  }
  return null;
}

/**
 * Last-resort checkpoint used after bounded semantic generation failures.
 * It deliberately preserves exact recent source instead of inventing a
 * natural-language summary, while older history is dropped Codex-style.
 */
export function buildContextCompactionEmergencySummary(params: {
  maxInstallableSummaryTokens: number;
  messages: readonly Record<string, unknown>[];
}): string | null {
  const { maxInstallableSummaryTokens, messages } = params;
  const build = (sourceMaxChars: number): string => {
    const source = stringifyCompactionSource(messages, sourceMaxChars);
    const quotedSource = source
      ? source.split("\n").map((line) => `> ${line}`).join("\n")
      : "> No recent source text fit the emergency checkpoint budget.";
    return [
      SUMMARY_HEADING,
      "## Active Request\n\nContinue the latest raw user request retained after this checkpoint. If no raw user request follows, continue the active run from the exact recent source below.",
      `## Current Work State\n\nModel-based compaction did not produce a safe summary. Exact retained recent source:\n\n${quotedSource}`,
      "## Safety and User Constraints\n\nHonor the retained system, service, and user constraints verbatim. Treat dropped older context as unknown and do not invent it.",
      `## Continuation Contract\n\nContinue from the exact recent source and following raw messages. Do not repeat work unless the retained evidence says it is incomplete.\n${SUMMARY_ESSENTIAL_COMPLETE_MARKER}`,
    ].join("\n\n");
  };

  let lower = 0;
  let upper = SUMMARY_SOURCE_MAX_CHARS;
  let fitted = build(0);
  if (estimateInputTokens(fitted) > maxInstallableSummaryTokens) {
    return null;
  }
  while (lower <= upper) {
    const sourceMaxChars = Math.floor((lower + upper) / 2);
    const candidate = build(sourceMaxChars);
    if (estimateInputTokens(candidate) <= maxInstallableSummaryTokens) {
      fitted = candidate;
      lower = sourceMaxChars + 1;
    } else {
      upper = sourceMaxChars - 1;
    }
  }
  return fitted;
}

/** Build a deterministic, smaller source for semantic compaction retries. */
export function selectContextCompactionAttemptMessages(
  messages: readonly Record<string, unknown>[],
  attempt: number,
): Record<string, unknown>[] {
  if (attempt <= 1) {
    return messages.map((message) => structuredClone(message));
  }
  const protectedHead = messages.slice(0, 2).filter((message) =>
    message.role === "system" || message.role === "service",
  );
  const tailCount = attempt >= 3 ? 2 : 6;
  const tail = messages.slice(-tailCount);
  const seen = new Set(protectedHead);
  const selectedMessages = [...protectedHead, ...tail].filter((message, index, selected) =>
    selected.indexOf(message) === index && (index < protectedHead.length || !seen.has(message)),
  );
  const contentRatio = attempt >= 3 ? 0.25 : 0.5;
  return selectedMessages.map((message) => {
    const copy = structuredClone(message);
    if (typeof copy.content === "string" && copy.content.length > 32) {
      const maxChars = Math.max(16, Math.floor(copy.content.length * contentRatio));
      copy.content = truncateSummarySourceString(copy.content, maxChars);
    }
    return copy;
  });
}
