import { estimateInputTokens } from "@nextclaw/core/model-input-budget";
import { normalizeAssistantText } from "@nextclaw/ncp";
import { stringifyCompactionSource, truncateSummarySourceString } from "./context-compaction-summary-source.utils.js";

const SUMMARY_SOURCE_MAX_CHARS = 120_000;
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
  "Summarize facts as Markdown starting '# Compressed Working Context'.",
  "Required nonempty headings, in order: Active Request; Current Work State; Safety and User Constraints; Continuation Contract. Close the last body with <!-- nextclaw-essential-context-complete -->.",
  "Include latest intent, decisions, constraints, changed files, evidence and next step. Distinguish Done/In Progress/Blocked/Failed; keep command/file identities and outcomes. Attempted calls alone are not completion.",
  "Update any previous summary: carry completed work and constraints forward, replace stale next steps. Completed requests are history. Repeat reads only for freshness/verification; recover uncertain side-effect status before repeating. A greeting does not erase the prior task or restart onboarding.",
  "Optional headings follow in order: Critical Technical Context; Evidence and Verification; Recent High-Fidelity Context; Older Relevant Context. Close each body with <!-- nextclaw-section-complete:SLUG -->, using critical-technical-context, evidence-and-verification, recent-high-fidelity-context, older-relevant-context respectively. Omit sections you cannot close.",
].join("\n");

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
  let sourceFitted = messages.length === 0;
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
    let candidate: Record<string, unknown>[];
    try {
      candidate = buildSummaryProviderMessages({ essentialOnly, messages, sourceMaxChars, targetSummaryTokens });
    } catch {
      lower = sourceMaxChars + 1;
      continue;
    }
    if (estimateInputTokens(candidate) <= maxInputTokens) {
      fitted = candidate;
      sourceFitted = true;
      lower = sourceMaxChars + 1;
    } else {
      upper = sourceMaxChars - 1;
    }
  }
  if (!sourceFitted) {
    throw new Error("Compaction source cannot fit without dropping message identities.");
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
 * natural-language summary, and explicitly marks older execution status unknown.
 */
export function buildContextCompactionEmergencySummary(params: {
  maxInstallableSummaryTokens: number;
  messages: readonly Record<string, unknown>[];
}): string | null {
  const { maxInstallableSummaryTokens, messages } = params;
  const build = (sourceMaxChars: number): string => {
    let source = "";
    try { source = stringifyCompactionSource(messages.slice(-2), sourceMaxChars); } catch { /* Explicit degraded recovery may have no source. */ }
    const quotedSource = source
      ? source.split("\n").map((line) => `> ${line}`).join("\n")
      : "> No recent source text fit the emergency checkpoint budget.";
    return [
      SUMMARY_HEADING,
      "## Active Request\n\nContinue the latest raw user request retained after this checkpoint. If no raw user request follows, continue the active run from the exact recent source below.",
      `## Current Work State\n\nModel-based compaction did not produce a safe summary. Exact retained recent source:\n\n${quotedSource}`,
      "## Safety and User Constraints\n\nHonor the retained system, service, and user constraints verbatim. Treat dropped older context as unknown and do not invent it.",
      `## Continuation Contract\n\nContinue from the exact recent source and following raw messages. Older execution state is unknown: recover evidence before repeating any side effect. Do not repeat work unless the retained evidence says it is incomplete.\n${SUMMARY_ESSENTIAL_COMPLETE_MARKER}`,
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
  const contentRatio = attempt >= 3 ? 0.25 : 0.5;
  return messages.map((message) => {
    const copy = structuredClone(message);
    if ((copy.role === "system" || copy.role === "service") && typeof copy.content === "string" && copy.content.includes("# Compressed Working Context")) return copy;
    if (typeof copy.content === "string" && copy.content.length > 32) {
      const maxChars = Math.max(16, Math.floor(copy.content.length * contentRatio));
      copy.content = truncateSummarySourceString(copy.content, maxChars);
    }
    return copy;
  });
}
