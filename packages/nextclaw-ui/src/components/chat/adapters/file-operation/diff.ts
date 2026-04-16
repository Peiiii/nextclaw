import type { ChatFileOperationLineViewModel } from "@nextclaw/agent-chat-ui";
import {
  buildLineDiff,
  buildPreviewLines,
  createLine,
  incrementLineNumber,
  readUnifiedDiffHunkStart,
  splitLines,
} from "@/components/chat/adapters/file-operation/line-builder";

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

function buildCaption(params: {
  operation?: string | null;
  lines: ChatFileOperationLineViewModel[];
}): string | undefined {
  const additions = params.lines.filter((line) => line.kind === "add").length;
  const deletions = params.lines.filter(
    (line) => line.kind === "remove",
  ).length;
  const parts: string[] = [];
  const normalizedOperation = params.operation?.trim().toLowerCase() ?? "";
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

function readDefaultDiffStartLines(params: {
  operation?: string | null;
  beforeText?: string | null;
  afterText?: string | null;
  oldStartLine?: number | null;
  newStartLine?: number | null;
}): {
  oldStartLine?: number;
  newStartLine?: number;
} {
  const normalizedOperation = params.operation?.trim().toLowerCase() ?? "";
  const oldStartLine =
    typeof params.oldStartLine === "number"
      ? params.oldStartLine
      : (normalizedOperation === "delete" ||
            normalizedOperation === "remove") &&
          params.beforeText != null
        ? 1
        : undefined;
  const newStartLine =
    typeof params.newStartLine === "number"
      ? params.newStartLine
      : (normalizedOperation === "write" || normalizedOperation === "add") &&
          params.afterText != null
        ? 1
        : undefined;
  return { oldStartLine, newStartLine };
}

function limitLines(lines: ChatFileOperationLineViewModel[]): {
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

export function buildRawPreviewBlock(params: {
  path: string;
  text: string;
  operation?: string | null;
  oldStartLine?: number | null;
  newStartLine?: number | null;
}): ParsedBlock | null {
  const previewText = params.text.trim();
  if (!previewText) {
    return null;
  }
  const previewKind =
    params.operation?.trim().toLowerCase() === "write" ? "add" : "context";
  const oldStartLine =
    typeof params.oldStartLine === "number" ? params.oldStartLine : 1;
  const newStartLine =
    typeof params.newStartLine === "number" ? params.newStartLine : 1;
  const lines = buildPreviewLines({
    text: previewText,
    kind: previewKind,
    oldStartLine,
    newStartLine,
  });
  return {
    path: params.path,
    display: "preview",
    caption: buildCaption({
      operation: params.operation,
      lines,
    }),
    lines,
    rawText: previewText,
    oldStartLine,
    newStartLine,
  };
}

export function buildFullReplaceBlock(params: {
  path: string;
  beforeText?: string | null;
  afterText?: string | null;
  operation?: string | null;
  oldStartLine?: number | null;
  newStartLine?: number | null;
}): ParsedBlock | null {
  const { oldStartLine, newStartLine } = readDefaultDiffStartLines(params);
  const lines = buildLineDiff({
    beforeText: params.beforeText ?? "",
    afterText: params.afterText ?? "",
    oldStartLine,
    newStartLine,
  });
  const limited = limitLines(lines);
  if (limited.lines.length === 0) {
    return null;
  }
  return {
    path: params.path,
    display: "diff",
    caption: buildCaption({
      operation: params.operation,
      lines,
    }),
    lines: limited.lines,
    ...(limited.truncated ? { fullLines: lines } : {}),
    ...(params.beforeText != null ? { beforeText: params.beforeText } : {}),
    ...(params.afterText != null ? { afterText: params.afterText } : {}),
    ...(typeof oldStartLine === "number" ? { oldStartLine } : {}),
    ...(typeof newStartLine === "number" ? { newStartLine } : {}),
    truncated: limited.truncated,
  };
}

function buildParsedPatchBlock(params: {
  path: string;
  operation: string | null;
  lines: ChatFileOperationLineViewModel[];
}): ParsedBlock {
  const limited = limitLines(params.lines);
  return {
    path: params.path,
    display: "diff",
    caption: buildCaption({
      operation: params.operation,
      lines: params.lines,
    }),
    lines: limited.lines,
    ...(limited.truncated ? { fullLines: params.lines } : {}),
    truncated: limited.truncated,
  };
}

function updateApplyPatchCursor(params: {
  line: string;
  flushCurrent: () => void;
  setCurrent: (path: string, operation: string) => void;
}): boolean {
  if (params.line.startsWith("*** Update File: ")) {
    params.flushCurrent();
    params.setCurrent(
      params.line.slice("*** Update File: ".length).trim(),
      "update",
    );
    return true;
  }
  if (params.line.startsWith("*** Add File: ")) {
    params.flushCurrent();
    params.setCurrent(params.line.slice("*** Add File: ".length).trim(), "add");
    return true;
  }
  if (params.line.startsWith("*** Delete File: ")) {
    params.flushCurrent();
    params.setCurrent(
      params.line.slice("*** Delete File: ".length).trim(),
      "delete",
    );
    return true;
  }
  return false;
}

function appendPatchLine(params: {
  currentLines: ChatFileOperationLineViewModel[];
  line: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}): {
  oldLineNumber?: number;
  newLineNumber?: number;
} {
  const { currentLines, line } = params;
  if (line.startsWith("+")) {
    currentLines.push(
      createLine({
        kind: "add",
        text: line.slice(1),
        newLineNumber: params.newLineNumber,
      }),
    );
    return {
      oldLineNumber: params.oldLineNumber,
      newLineNumber: incrementLineNumber(params.newLineNumber),
    };
  }
  if (line.startsWith("-")) {
    currentLines.push(
      createLine({
        kind: "remove",
        text: line.slice(1),
        oldLineNumber: params.oldLineNumber,
      }),
    );
    return {
      oldLineNumber: incrementLineNumber(params.oldLineNumber),
      newLineNumber: params.newLineNumber,
    };
  }
  if (line.startsWith(" ")) {
    currentLines.push(
      createLine({
        kind: "context",
        text: line.slice(1),
        oldLineNumber: params.oldLineNumber,
        newLineNumber: params.newLineNumber,
      }),
    );
    return {
      oldLineNumber: incrementLineNumber(params.oldLineNumber),
      newLineNumber: incrementLineNumber(params.newLineNumber),
    };
  }
  return {
    oldLineNumber: params.oldLineNumber,
    newLineNumber: params.newLineNumber,
  };
}

function parseApplyPatchText(patchText: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  let currentPath: string | null = null;
  let currentOperation: string | null = null;
  let currentLines: ChatFileOperationLineViewModel[] = [];
  let currentOldLineNumber: number | undefined;
  let currentNewLineNumber: number | undefined;

  const flushCurrent = () => {
    if (!currentPath) {
      currentLines = [];
      currentOperation = null;
      currentOldLineNumber = undefined;
      currentNewLineNumber = undefined;
      return;
    }
    blocks.push(
      buildParsedPatchBlock({
        path: currentPath,
        operation: currentOperation,
        lines: currentLines,
      }),
    );
    currentPath = null;
    currentOperation = null;
    currentLines = [];
    currentOldLineNumber = undefined;
    currentNewLineNumber = undefined;
  };

  for (const line of splitLines(patchText)) {
    if (
      updateApplyPatchCursor({
        line,
        flushCurrent,
        setCurrent: (path, operation) => {
          currentPath = path;
          currentOperation = operation;
        },
      })
    ) {
      continue;
    }
    if (
      line.startsWith("*** Move to: ") ||
      line.startsWith("*** Begin Patch") ||
      line.startsWith("*** End Patch")
    ) {
      continue;
    }
    if (line.startsWith("@@")) {
      const hunkStart = readUnifiedDiffHunkStart(line);
      currentOldLineNumber = hunkStart?.oldLineNumber;
      currentNewLineNumber = hunkStart?.newLineNumber;
      continue;
    }
    if (!currentPath) {
      continue;
    }
    const nextCursor = appendPatchLine({
      currentLines,
      line,
      oldLineNumber: currentOldLineNumber,
      newLineNumber: currentNewLineNumber,
    });
    currentOldLineNumber = nextCursor.oldLineNumber;
    currentNewLineNumber = nextCursor.newLineNumber;
  }

  flushCurrent();
  return blocks;
}

function parseUnifiedDiffText(patchText: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  let currentPath: string | null = null;
  let currentLines: ChatFileOperationLineViewModel[] = [];
  let currentOldLineNumber: number | undefined;
  let currentNewLineNumber: number | undefined;

  const flushCurrent = () => {
    if (!currentPath) {
      currentLines = [];
      currentOldLineNumber = undefined;
      currentNewLineNumber = undefined;
      return;
    }
    blocks.push(
      buildParsedPatchBlock({
        path: currentPath,
        operation: "update",
        lines: currentLines,
      }),
    );
    currentPath = null;
    currentLines = [];
    currentOldLineNumber = undefined;
    currentNewLineNumber = undefined;
  };

  for (const line of splitLines(patchText)) {
    if (line.startsWith("+++ ")) {
      flushCurrent();
      currentPath = line
        .slice(4)
        .trim()
        .replace(/^b\//, "")
        .replace(/^a\//, "");
      continue;
    }
    if (line.startsWith("--- ")) {
      continue;
    }
    if (line.startsWith("@@")) {
      const hunkStart = readUnifiedDiffHunkStart(line);
      currentOldLineNumber = hunkStart?.oldLineNumber;
      currentNewLineNumber = hunkStart?.newLineNumber;
      continue;
    }
    if (!currentPath) {
      continue;
    }
    const nextCursor = appendPatchLine({
      currentLines,
      line,
      oldLineNumber: currentOldLineNumber,
      newLineNumber: currentNewLineNumber,
    });
    currentOldLineNumber = nextCursor.oldLineNumber;
    currentNewLineNumber = nextCursor.newLineNumber;
  }

  flushCurrent();
  return blocks;
}

export function parsePatchBlocks(patchText: string): ParsedBlock[] {
  if (patchText.includes("*** Begin Patch")) {
    return parseApplyPatchText(patchText);
  }
  if (patchText.includes("--- ") && patchText.includes("+++ ")) {
    return parseUnifiedDiffText(patchText);
  }
  return [];
}
