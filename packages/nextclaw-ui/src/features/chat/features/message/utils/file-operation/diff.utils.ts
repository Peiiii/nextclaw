import type { ChatFileOperationLineViewModel } from "@nextclaw/agent-chat-ui";
import {
  buildLineDiff,
  buildPreviewLines,
  createLine,
  incrementLineNumber,
  readUnifiedDiffHunkStart,
  splitLines,
} from "./line-builder.utils";
import {
  buildCaption,
  buildParsedPatchBlock,
  limitLines,
  readDefaultDiffStartLines,
  type ParsedBlock,
} from "./parsed-block.utils";

export type { ParsedBlock } from "./parsed-block.utils";

export function buildRawPreviewBlock(params: {
  path: string;
  text: string;
  operation?: string | null;
  oldStartLine?: number | null;
  newStartLine?: number | null;
}): ParsedBlock | null {
  const { newStartLine: rawNewStartLine, oldStartLine: rawOldStartLine, operation, path, text } = params;
  const previewText = text.trim();
  if (!previewText) {
    return null;
  }
  const previewKind =
    operation?.trim().toLowerCase() === "write" ? "add" : "context";
  const oldStartLine =
    typeof rawOldStartLine === "number" ? rawOldStartLine : 1;
  const newStartLine =
    typeof rawNewStartLine === "number" ? rawNewStartLine : 1;
  const lines = buildPreviewLines({
    text: previewText,
    kind: previewKind,
    oldStartLine,
    newStartLine,
  });
  return {
    path,
    display: "preview",
    caption: buildCaption({
      operation,
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
  const { afterText, beforeText, operation, path } = params;
  const { oldStartLine, newStartLine } = readDefaultDiffStartLines(params);
  const lines = buildLineDiff({
    beforeText: beforeText ?? "",
    afterText: afterText ?? "",
    oldStartLine,
    newStartLine,
  });
  const limited = limitLines(lines);
  if (limited.lines.length === 0) {
    return null;
  }
  return {
    path,
    display: "diff",
    caption: buildCaption({
      operation,
      lines,
    }),
    lines: limited.lines,
    ...(limited.truncated ? { fullLines: lines } : {}),
    ...(beforeText != null ? { beforeText } : {}),
    ...(afterText != null ? { afterText } : {}),
    ...(typeof oldStartLine === "number" ? { oldStartLine } : {}),
    ...(typeof newStartLine === "number" ? { newStartLine } : {}),
    truncated: limited.truncated,
  };
}

function updateApplyPatchCursor(params: {
  line: string;
  flushCurrent: () => void;
  setCurrent: (path: string, operation: string) => void;
}): boolean {
  const { flushCurrent, line, setCurrent } = params;
  if (line.startsWith("*** Update File: ")) {
    flushCurrent();
    setCurrent(
      line.slice("*** Update File: ".length).trim(),
      "update",
    );
    return true;
  }
  if (line.startsWith("*** Add File: ")) {
    flushCurrent();
    setCurrent(line.slice("*** Add File: ".length).trim(), "add");
    return true;
  }
  if (line.startsWith("*** Delete File: ")) {
    flushCurrent();
    setCurrent(
      line.slice("*** Delete File: ".length).trim(),
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
  const { currentLines, line, newLineNumber, oldLineNumber } = params;
  if (line.startsWith("+")) {
    currentLines.push(
      createLine({
        kind: "add",
        text: line.slice(1),
        newLineNumber,
      }),
    );
    return {
      oldLineNumber,
      newLineNumber: incrementLineNumber(newLineNumber),
    };
  }
  if (line.startsWith("-")) {
    currentLines.push(
      createLine({
        kind: "remove",
        text: line.slice(1),
        oldLineNumber,
      }),
    );
    return {
      oldLineNumber: incrementLineNumber(oldLineNumber),
      newLineNumber,
    };
  }
  if (line.startsWith(" ")) {
    currentLines.push(
      createLine({
        kind: "context",
        text: line.slice(1),
        oldLineNumber,
        newLineNumber,
      }),
    );
    return {
      oldLineNumber: incrementLineNumber(oldLineNumber),
      newLineNumber: incrementLineNumber(newLineNumber),
    };
  }
  return {
    oldLineNumber,
    newLineNumber,
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
