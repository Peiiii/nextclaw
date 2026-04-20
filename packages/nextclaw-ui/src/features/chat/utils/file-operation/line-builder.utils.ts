import type { ChatFileOperationLineViewModel } from "@nextclaw/agent-chat-ui";

const MAX_DIFF_MATRIX_CELLS = 12_000;
const UNIFIED_DIFF_HUNK_HEADER_PATTERN =
  /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

export function splitLines(value: string): string[] {
  const normalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return normalized === "" ? [] : normalized.split("\n");
}

export function incrementLineNumber(value?: number): number | undefined {
  return typeof value === "number" ? value + 1 : undefined;
}

export function createLine(params: {
  kind: ChatFileOperationLineViewModel["kind"];
  text: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}): ChatFileOperationLineViewModel {
  return {
    kind: params.kind,
    text: params.text,
    ...(typeof params.oldLineNumber === "number"
      ? { oldLineNumber: params.oldLineNumber }
      : {}),
    ...(typeof params.newLineNumber === "number"
      ? { newLineNumber: params.newLineNumber }
      : {}),
  };
}

export function readUnifiedDiffHunkStart(line: string): {
  oldLineNumber: number;
  newLineNumber: number;
} | null {
  const match = UNIFIED_DIFF_HUNK_HEADER_PATTERN.exec(line);
  if (!match) {
    return null;
  }
  return {
    oldLineNumber: Number(match[1]),
    newLineNumber: Number(match[2]),
  };
}

export function buildPreviewLines(params: {
  text: string;
  kind: "add" | "context";
  oldStartLine: number;
  newStartLine: number;
}): ChatFileOperationLineViewModel[] {
  return splitLines(params.text).map((line, index) =>
    params.kind === "add"
      ? createLine({
          kind: "add",
          text: line,
          newLineNumber: params.newStartLine + index,
        })
      : createLine({
          kind: "context",
          text: line,
          oldLineNumber: params.oldStartLine + index,
          newLineNumber: params.newStartLine + index,
        }),
  );
}

function buildFallbackDiffLines(params: {
  beforeLines: string[];
  afterLines: string[];
  oldStartLine?: number;
  newStartLine?: number;
}): ChatFileOperationLineViewModel[] {
  let oldLineNumber = params.oldStartLine;
  let newLineNumber = params.newStartLine;
  return [
    ...params.beforeLines.map((line) => {
      const nextLine = createLine({
        kind: "remove",
        text: line,
        oldLineNumber,
      });
      oldLineNumber = incrementLineNumber(oldLineNumber);
      return nextLine;
    }),
    ...params.afterLines.map((line) => {
      const nextLine = createLine({
        kind: "add",
        text: line,
        newLineNumber,
      });
      newLineNumber = incrementLineNumber(newLineNumber);
      return nextLine;
    }),
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
  for (
    let beforeIndex = params.beforeLines.length - 1;
    beforeIndex >= 0;
    beforeIndex -= 1
  ) {
    for (
      let afterIndex = params.afterLines.length - 1;
      afterIndex >= 0;
      afterIndex -= 1
    ) {
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
  oldLineNumber?: number;
  newLineNumber?: number;
}): void {
  for (
    let index = params.beforeIndex;
    index < params.beforeLines.length;
    index += 1
  ) {
    params.lines.push(
      createLine({
        kind: "remove",
        text: params.beforeLines[index] ?? "",
        oldLineNumber: params.oldLineNumber,
      }),
    );
    params.oldLineNumber = incrementLineNumber(params.oldLineNumber);
  }
  for (
    let index = params.afterIndex;
    index < params.afterLines.length;
    index += 1
  ) {
    params.lines.push(
      createLine({
        kind: "add",
        text: params.afterLines[index] ?? "",
        newLineNumber: params.newLineNumber,
      }),
    );
    params.newLineNumber = incrementLineNumber(params.newLineNumber);
  }
}

export function buildLineDiff(params: {
  beforeText: string;
  afterText: string;
  oldStartLine?: number;
  newStartLine?: number;
}): ChatFileOperationLineViewModel[] {
  const beforeLines = splitLines(params.beforeText);
  const afterLines = splitLines(params.afterText);
  if (beforeLines.length * afterLines.length > MAX_DIFF_MATRIX_CELLS) {
    return buildFallbackDiffLines({
      beforeLines,
      afterLines,
      oldStartLine: params.oldStartLine,
      newStartLine: params.newStartLine,
    });
  }

  const lcs = buildLcsMatrix({
    beforeLines,
    afterLines,
  });
  const lines: ChatFileOperationLineViewModel[] = [];
  let beforeIndex = 0;
  let afterIndex = 0;
  let oldLineNumber = params.oldStartLine;
  let newLineNumber = params.newStartLine;
  while (beforeIndex < beforeLines.length && afterIndex < afterLines.length) {
    if (beforeLines[beforeIndex] === afterLines[afterIndex]) {
      lines.push(
        createLine({
          kind: "context",
          text: beforeLines[beforeIndex] ?? "",
          oldLineNumber,
          newLineNumber,
        }),
      );
      beforeIndex += 1;
      afterIndex += 1;
      oldLineNumber = incrementLineNumber(oldLineNumber);
      newLineNumber = incrementLineNumber(newLineNumber);
      continue;
    }

    if (
      (lcs[beforeIndex + 1]![afterIndex] ?? 0) >=
      (lcs[beforeIndex]![afterIndex + 1] ?? 0)
    ) {
      lines.push(
        createLine({
          kind: "remove",
          text: beforeLines[beforeIndex] ?? "",
          oldLineNumber,
        }),
      );
      beforeIndex += 1;
      oldLineNumber = incrementLineNumber(oldLineNumber);
      continue;
    }

    lines.push(
      createLine({
        kind: "add",
        text: afterLines[afterIndex] ?? "",
        newLineNumber,
      }),
    );
    afterIndex += 1;
    newLineNumber = incrementLineNumber(newLineNumber);
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
