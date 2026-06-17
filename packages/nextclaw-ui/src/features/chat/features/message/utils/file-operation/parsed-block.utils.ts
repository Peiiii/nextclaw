import type { ChatFileOperationLineViewModel } from "@nextclaw/agent-chat-ui";

export type ParsedBlock = {
  path: string;
  display: "preview" | "diff";
  caption?: string;
  lines: ChatFileOperationLineViewModel[];
  fullLines?: ChatFileOperationLineViewModel[];
  rawText?: string;
  beforeText?: string;
  afterText?: string;
  oldStartLine?: number;
  newStartLine?: number;
  truncated?: boolean;
};

const MAX_VISIBLE_DIFF_LINES = 120;

export function buildCaption(params: {
  operation?: string | null;
  lines: ChatFileOperationLineViewModel[];
}): string | undefined {
  const { lines, operation } = params;
  const additions = lines.filter((line) => line.kind === "add").length;
  const deletions = lines.filter((line) => line.kind === "remove").length;
  const parts: string[] = [];
  const normalizedOperation = operation?.trim().toLowerCase() ?? "";
  if (normalizedOperation && normalizedOperation !== "update") {
    parts.push(normalizedOperation);
  }
  if (additions > 0) {
    parts.push(`+${additions}`);
  }
  if (deletions > 0) {
    parts.push(`-${deletions}`);
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

export function readDefaultDiffStartLines(params: {
  operation?: string | null;
  beforeText?: string | null;
  afterText?: string | null;
  oldStartLine?: number | null;
  newStartLine?: number | null;
}): {
  oldStartLine?: number;
  newStartLine?: number;
} {
  const { afterText, beforeText, newStartLine: rawNewStartLine, oldStartLine: rawOldStartLine, operation } = params;
  const normalizedOperation = operation?.trim().toLowerCase() ?? "";
  const oldStartLine =
    typeof rawOldStartLine === "number"
      ? rawOldStartLine
      : (normalizedOperation === "delete" ||
            normalizedOperation === "remove") &&
          beforeText != null
        ? 1
        : undefined;
  const newStartLine =
    typeof rawNewStartLine === "number"
      ? rawNewStartLine
      : (normalizedOperation === "write" || normalizedOperation === "add") &&
          afterText != null
        ? 1
        : undefined;
  return { oldStartLine, newStartLine };
}

export function limitLines(lines: ChatFileOperationLineViewModel[]): {
  lines: ChatFileOperationLineViewModel[];
  truncated: boolean;
} {
  if (lines.length <= MAX_VISIBLE_DIFF_LINES) {
    return { lines, truncated: false };
  }
  return {
    lines: lines.slice(0, MAX_VISIBLE_DIFF_LINES),
    truncated: true,
  };
}

export function buildParsedPatchBlock(params: {
  path: string;
  operation: string | null;
  lines: ChatFileOperationLineViewModel[];
}): ParsedBlock {
  const { lines, operation, path } = params;
  const limited = limitLines(lines);
  return {
    path,
    display: "diff",
    caption: buildCaption({
      operation,
      lines,
    }),
    lines: limited.lines,
    ...(limited.truncated ? { fullLines: lines } : {}),
    truncated: limited.truncated,
  };
}
