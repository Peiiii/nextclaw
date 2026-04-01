import type { ChatFileOperationLineViewModel } from "@nextclaw/agent-chat-ui";

export type ParsedBlock = {
  path: string;
  display: "preview" | "diff";
  caption?: string;
  lines: ChatFileOperationLineViewModel[];
  rawText?: string;
  truncated?: boolean;
};

const MAX_VISIBLE_DIFF_LINES = 120;
const MAX_DIFF_MATRIX_CELLS = 12_000;

function splitLines(value: string): string[] {
  const normalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return normalized === "" ? [] : normalized.split("\n");
}

function buildCaption(params: {
  operation?: string | null;
  lines: ChatFileOperationLineViewModel[];
}): string | undefined {
  const additions = params.lines.filter((line) => line.kind === "add").length;
  const deletions = params.lines.filter((line) => line.kind === "remove").length;
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

function limitLines(
  lines: ChatFileOperationLineViewModel[],
): { lines: ChatFileOperationLineViewModel[]; truncated: boolean } {
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
}): ParsedBlock | null {
  const previewText = params.text.trim();
  if (!previewText) {
    return null;
  }
  const previewKind = params.operation?.trim().toLowerCase() === "write" ? "add" : "context";
  const lines = splitLines(previewText).map((line, index) =>
    previewKind === "add"
      ? {
          kind: "add" as const,
          text: line,
          newLineNumber: index + 1,
        }
      : {
          kind: "context" as const,
          text: line,
          oldLineNumber: index + 1,
          newLineNumber: index + 1,
        },
  );
  return {
    path: params.path,
    display: "preview",
    caption: buildCaption({
      operation: params.operation,
      lines,
    }),
    lines,
  };
}

function buildFallbackDiffLines(params: {
  beforeLines: string[];
  afterLines: string[];
}): ChatFileOperationLineViewModel[] {
  return [
    ...params.beforeLines.map((line, index) => ({
      kind: "remove" as const,
      text: line,
      oldLineNumber: index + 1,
    })),
    ...params.afterLines.map((line, index) => ({
      kind: "add" as const,
      text: line,
      newLineNumber: index + 1,
    })),
  ];
}

function buildLcsMatrix(params: {
  beforeLines: string[];
  afterLines: string[];
}): number[][] {
  const matrix: number[][] = Array.from(
    { length: params.beforeLines.length + 1 },
    () => Array.from({ length: params.afterLines.length + 1 }, () => 0),
  );
  for (let beforeIndex = params.beforeLines.length - 1; beforeIndex >= 0; beforeIndex -= 1) {
    for (let afterIndex = params.afterLines.length - 1; afterIndex >= 0; afterIndex -= 1) {
      matrix[beforeIndex]![afterIndex] =
        params.beforeLines[beforeIndex] === params.afterLines[afterIndex]
          ? (matrix[beforeIndex + 1]![afterIndex + 1] ?? 0) + 1
          : Math.max(
              matrix[beforeIndex + 1]![afterIndex] ?? 0,
              matrix[beforeIndex]![afterIndex + 1] ?? 0,
            );
    }
  }
  return matrix;
}

function appendRemainingDiffLines(params: {
  lines: ChatFileOperationLineViewModel[];
  beforeLines: string[];
  afterLines: string[];
  beforeIndex: number;
  afterIndex: number;
  oldLineNumber: number;
  newLineNumber: number;
}): void {
  for (let index = params.beforeIndex; index < params.beforeLines.length; index += 1) {
    params.lines.push({
      kind: "remove",
      text: params.beforeLines[index] ?? "",
      oldLineNumber: params.oldLineNumber,
    });
    params.oldLineNumber += 1;
  }
  for (let index = params.afterIndex; index < params.afterLines.length; index += 1) {
    params.lines.push({
      kind: "add",
      text: params.afterLines[index] ?? "",
      newLineNumber: params.newLineNumber,
    });
    params.newLineNumber += 1;
  }
}

function buildLineDiff(
  beforeText: string,
  afterText: string,
): ChatFileOperationLineViewModel[] {
  const beforeLines = splitLines(beforeText);
  const afterLines = splitLines(afterText);
  if (beforeLines.length * afterLines.length > MAX_DIFF_MATRIX_CELLS) {
    return buildFallbackDiffLines({
      beforeLines,
      afterLines,
    });
  }

  const lcs = buildLcsMatrix({
    beforeLines,
    afterLines,
  });
  const lines: ChatFileOperationLineViewModel[] = [];
  let beforeIndex = 0;
  let afterIndex = 0;
  let oldLineNumber = 1;
  let newLineNumber = 1;
  while (beforeIndex < beforeLines.length && afterIndex < afterLines.length) {
    if (beforeLines[beforeIndex] === afterLines[afterIndex]) {
      lines.push({
        kind: "context",
        text: beforeLines[beforeIndex] ?? "",
        oldLineNumber,
        newLineNumber,
      });
      beforeIndex += 1;
      afterIndex += 1;
      oldLineNumber += 1;
      newLineNumber += 1;
      continue;
    }

    if ((lcs[beforeIndex + 1]![afterIndex] ?? 0) >= (lcs[beforeIndex]![afterIndex + 1] ?? 0)) {
      lines.push({
        kind: "remove",
        text: beforeLines[beforeIndex] ?? "",
        oldLineNumber,
      });
      beforeIndex += 1;
      oldLineNumber += 1;
      continue;
    }

    lines.push({
      kind: "add",
      text: afterLines[afterIndex] ?? "",
      newLineNumber,
    });
    afterIndex += 1;
    newLineNumber += 1;
  }

  appendRemainingDiffLines({
    lines,
    beforeLines,
    afterLines,
    beforeIndex,
    afterIndex,
    oldLineNumber,
    newLineNumber,
  });
  return lines;
}

export function buildFullReplaceBlock(params: {
  path: string;
  beforeText?: string | null;
  afterText?: string | null;
  operation?: string | null;
}): ParsedBlock | null {
  const lines = buildLineDiff(params.beforeText ?? "", params.afterText ?? "");
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
    params.setCurrent(params.line.slice("*** Update File: ".length).trim(), "update");
    return true;
  }
  if (params.line.startsWith("*** Add File: ")) {
    params.flushCurrent();
    params.setCurrent(params.line.slice("*** Add File: ".length).trim(), "add");
    return true;
  }
  if (params.line.startsWith("*** Delete File: ")) {
    params.flushCurrent();
    params.setCurrent(params.line.slice("*** Delete File: ".length).trim(), "delete");
    return true;
  }
  return false;
}

function appendPatchLine(
  currentLines: ChatFileOperationLineViewModel[],
  line: string,
): void {
  if (line.startsWith("+")) {
    currentLines.push({
      kind: "add",
      text: line.slice(1),
    });
    return;
  }
  if (line.startsWith("-")) {
    currentLines.push({
      kind: "remove",
      text: line.slice(1),
    });
    return;
  }
  if (line.startsWith(" ")) {
    currentLines.push({
      kind: "context",
      text: line.slice(1),
    });
  }
}

function parseApplyPatchText(patchText: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  let currentPath: string | null = null;
  let currentOperation: string | null = null;
  let currentLines: ChatFileOperationLineViewModel[] = [];

  const flushCurrent = () => {
    if (!currentPath) {
      currentLines = [];
      currentOperation = null;
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
    if (line.startsWith("*** Move to: ") || line.startsWith("*** Begin Patch") || line.startsWith("*** End Patch")) {
      continue;
    }
    if (line.startsWith("@@") || !currentPath) {
      continue;
    }
    appendPatchLine(currentLines, line);
  }

  flushCurrent();
  return blocks;
}

function parseUnifiedDiffText(patchText: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  let currentPath: string | null = null;
  let currentLines: ChatFileOperationLineViewModel[] = [];

  const flushCurrent = () => {
    if (!currentPath) {
      currentLines = [];
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
  };

  for (const line of splitLines(patchText)) {
    if (line.startsWith("+++ ")) {
      flushCurrent();
      currentPath = line.slice(4).trim().replace(/^b\//, "").replace(/^a\//, "");
      continue;
    }
    if (line.startsWith("--- ") || line.startsWith("@@") || !currentPath) {
      continue;
    }
    appendPatchLine(currentLines, line);
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
