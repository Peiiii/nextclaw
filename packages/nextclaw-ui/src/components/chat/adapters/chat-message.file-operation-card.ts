import type {
  ChatFileOperationBlockViewModel,
} from "@nextclaw/agent-chat-ui";
import {
  buildFullReplaceBlock,
  buildRawPreviewBlock,
  parsePatchBlocks,
  type ParsedBlock,
} from "@/components/chat/adapters/chat-message.file-operation-diff";
import { readPartialJsonStringField } from "@/components/chat/adapters/chat-message.partial-json";

type ToolInvocationSource = {
  toolName: string;
  status?: string;
  toolCallId?: string;
  args?: unknown;
  parsedArgs?: unknown;
  result?: unknown;
};

type FileOperationCardData = {
  summary?: string;
  fileOperation?: {
    blocks: ChatFileOperationBlockViewModel[];
  };
};

const FILE_TOOL_NAMES = new Set([
  "file_change",
  "read_file",
  "write_file",
  "edit_file",
  "apply_patch",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePath(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return null;
}

function readRecordPayload(value: unknown): Record<string, unknown> | null {
  if (isRecord(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed.startsWith("{")) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readPartialRecordPayload(value: unknown): Record<string, unknown> | null {
  if (isRecord(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed.startsWith("{")) {
    return null;
  }
  const path =
    readPartialJsonStringField(trimmed, [
      "path",
      "filePath",
      "file_path",
      "targetPath",
      "target_path",
      "filename",
      "name",
    ])?.value ?? null;
  const content =
    readPartialJsonStringField(
      trimmed,
      ["content", "text", "afterText", "after_text"],
    )?.value ?? null;
  const oldText =
    readPartialJsonStringField(
      trimmed,
      ["oldText", "beforeText", "before_text"],
    )?.value ?? null;
  const newText =
    readPartialJsonStringField(
      trimmed,
      ["newText", "afterText", "after_text"],
    )?.value ?? null;
  const patch =
    readPartialJsonStringField(
      trimmed,
      ["patch", "diff", "unifiedDiff", "unified_diff"],
    )?.value ?? null;

  const partialRecord: Record<string, unknown> = {};
  if (path) {
    partialRecord.path = path;
  }
  if (content) {
    partialRecord.content = content;
  }
  if (oldText) {
    partialRecord.oldText = oldText;
  }
  if (newText) {
    partialRecord.newText = newText;
  }
  if (patch) {
    partialRecord.patch = patch;
  }

  return Object.keys(partialRecord).length > 0 ? partialRecord : null;
}

function readPath(record: Record<string, unknown>): string | null {
  return (
    normalizePath(record.path) ??
    normalizePath(record.filePath) ??
    normalizePath(record.file_path) ??
    normalizePath(record.targetPath) ??
    normalizePath(record.target_path) ??
    normalizePath(record.filename) ??
    normalizePath(record.name)
  );
}

function readOperation(record: Record<string, unknown>): string | null {
  return (
    readNonEmptyString(record.operation) ??
    readNonEmptyString(record.op) ??
    readNonEmptyString(record.action) ??
    readNonEmptyString(record.kind) ??
    readNonEmptyString(record.type) ??
    readNonEmptyString(record.status)
  );
}

function readPatchText(record: Record<string, unknown>): string | null {
  return (
    readNonEmptyString(record.patch) ??
    readNonEmptyString(record.diff) ??
    readNonEmptyString(record.unifiedDiff) ??
    readNonEmptyString(record.unified_diff)
  );
}

function readBeforeText(record: Record<string, unknown>): string | null {
  return (
    readNonEmptyString(record.beforeText) ??
    readNonEmptyString(record.before_text) ??
    readNonEmptyString(record.oldText) ??
    readNonEmptyString(record.old_text) ??
    readNonEmptyString(record.oldContent) ??
    readNonEmptyString(record.old_content) ??
    readNonEmptyString(record.before) ??
    readNonEmptyString(record.previous)
  );
}

function readAfterText(record: Record<string, unknown>): string | null {
  return (
    readNonEmptyString(record.afterText) ??
    readNonEmptyString(record.after_text) ??
    readNonEmptyString(record.newText) ??
    readNonEmptyString(record.new_text) ??
    readNonEmptyString(record.newContent) ??
    readNonEmptyString(record.new_content) ??
    readNonEmptyString(record.content) ??
    readNonEmptyString(record.text) ??
    readNonEmptyString(record.after) ??
    readNonEmptyString(record.updated)
  );
}

function finalizeParsedBlocks(blocks: ParsedBlock[]): FileOperationCardData | null {
  const normalizedBlocks = blocks
    .map((block, index) => ({
      key: `${block.path}-${index + 1}`,
      path: block.path,
      display: block.display,
      ...(block.caption ? { caption: block.caption } : {}),
      lines: block.lines,
      ...(block.rawText ? { rawText: block.rawText } : {}),
      ...(block.truncated ? { truncated: true } : {}),
    }))
    .filter((block) => block.lines.length > 0 || Boolean(block.rawText));

  if (normalizedBlocks.length === 0) {
    return null;
  }

  const paths = normalizedBlocks.map((block) => block.path);
  const summary =
    paths.length === 1
      ? paths[0]
      : `${paths.length} files · ${paths.slice(0, 2).join(" · ")}${paths.length > 2 ? " …" : ""}`;

  return {
    summary,
    fileOperation: {
      blocks: normalizedBlocks,
    },
  };
}

function buildBlockFromChangeRecord(record: Record<string, unknown>, fallbackPath: string): ParsedBlock | null {
  const path = readPath(record) ?? fallbackPath;
  const operation = readOperation(record);
  const patchText = readPatchText(record);
  if (patchText) {
    const parsedBlocks = parsePatchBlocks(patchText);
    if (parsedBlocks.length > 0) {
      return parsedBlocks[0] ?? null;
    }
  }

  const beforeText = readBeforeText(record);
  const afterText = readAfterText(record);
  if (beforeText != null || afterText != null) {
    return buildFullReplaceBlock({
      path,
      beforeText,
      afterText,
      operation,
    });
  }

  const previewText = readNonEmptyString(record.preview);
  if (previewText) {
    return buildRawPreviewBlock({
      path,
      text: previewText,
      operation,
    });
  }

  return null;
}

function buildBlocksFromChanges(changes: unknown): ParsedBlock[] {
  if (!Array.isArray(changes)) {
    return [];
  }

  const blocks: ParsedBlock[] = [];
  changes.forEach((entry, index) => {
    if (typeof entry === "string") {
      const parsedBlocks = parsePatchBlocks(entry);
      if (parsedBlocks.length > 0) {
        blocks.push(...parsedBlocks);
      }
      return;
    }
    if (!isRecord(entry)) {
      return;
    }
    const path = readPath(entry) ?? `file-${index + 1}`;
    const block = buildBlockFromChangeRecord(entry, path);
    if (block) {
      blocks.push(block);
      return;
    }
    const nestedChanges = Array.isArray(entry.changes) ? buildBlocksFromChanges(entry.changes) : [];
    if (nestedChanges.length > 0) {
      blocks.push(...nestedChanges);
    }
  });
  return blocks;
}

function buildFileChangeCardData(invocation: ToolInvocationSource): FileOperationCardData | null {
  const sourceRecord =
    readRecordPayload(invocation.result) ??
    readRecordPayload(invocation.parsedArgs) ??
    readRecordPayload(invocation.args);
  if (!sourceRecord) {
    return null;
  }
  const blocks = buildBlocksFromChanges(sourceRecord.changes);
  return finalizeParsedBlocks(blocks);
}

function buildReadFileCardData(invocation: ToolInvocationSource): FileOperationCardData | null {
  const argsRecord =
    readRecordPayload(invocation.parsedArgs) ??
    readRecordPayload(invocation.args) ??
    readPartialRecordPayload(invocation.args);
  const path = argsRecord && readPath(argsRecord);
  const content = readNonEmptyString(invocation.result);
  if (!path || !content) {
    return null;
  }
  return finalizeParsedBlocks(
    [
      buildRawPreviewBlock({
        path,
        text: content,
        operation: "read",
      }),
    ].filter((block): block is ParsedBlock => Boolean(block)),
  );
}

function buildWriteFileCardData(invocation: ToolInvocationSource): FileOperationCardData | null {
  const isStreamingPartialCall = invocation.status === "partial-call";
  if (isStreamingPartialCall && typeof invocation.args === "string") {
    const pathField = readPartialJsonStringField(invocation.args, [
      "path",
      "filePath",
      "file_path",
      "targetPath",
      "target_path",
      "filename",
      "name",
    ]);
    const contentField = readPartialJsonStringField(
      invocation.args,
      ["content", "text", "afterText", "after_text"],
    );
    if (pathField?.value && contentField?.value) {
      const previewBlock = buildRawPreviewBlock({
        path: pathField.value,
        text: contentField.value,
        operation: "write",
      });
      if (previewBlock) {
        return finalizeParsedBlocks([previewBlock]);
      }
    }
  }

  const argsRecord =
    readRecordPayload(invocation.parsedArgs) ??
    readRecordPayload(invocation.args) ??
    readPartialRecordPayload(invocation.args);
  if (!argsRecord) {
    return null;
  }
  const path = readPath(argsRecord);
  const content = readNonEmptyString(argsRecord.content);
  if (!path || !content) {
    return null;
  }
  return finalizeParsedBlocks(
    [
      buildRawPreviewBlock({
        path,
        text: content,
        operation: "write",
      }),
    ].filter((block): block is ParsedBlock => Boolean(block)),
  );
}

function buildEditFileCardData(invocation: ToolInvocationSource): FileOperationCardData | null {
  const argsRecord =
    readRecordPayload(invocation.parsedArgs) ??
    readRecordPayload(invocation.args) ??
    readPartialRecordPayload(invocation.args);
  if (!argsRecord) {
    return null;
  }
  const path = readPath(argsRecord);
  const beforeText = readNonEmptyString(argsRecord.oldText) ?? readNonEmptyString(argsRecord.beforeText);
  const afterText = readNonEmptyString(argsRecord.newText) ?? readNonEmptyString(argsRecord.afterText);
  if (!path || (beforeText == null && afterText == null)) {
    return null;
  }
  return finalizeParsedBlocks(
    [
      buildFullReplaceBlock({
        path,
        beforeText,
        afterText,
        operation: "edit",
      }),
    ].filter((block): block is ParsedBlock => Boolean(block)),
  );
}

function buildApplyPatchCardData(invocation: ToolInvocationSource): FileOperationCardData | null {
  const parsedArgsRecord = readRecordPayload(invocation.parsedArgs);
  const argsRecord = readRecordPayload(invocation.args) ?? readPartialRecordPayload(invocation.args);
  const patchText =
    readNonEmptyString(invocation.args) ??
    (parsedArgsRecord ? readNonEmptyString(parsedArgsRecord.patch) : null) ??
    (argsRecord ? readNonEmptyString(argsRecord.patch) : null);
  if (!patchText) {
    return null;
  }
  return finalizeParsedBlocks(parsePatchBlocks(patchText));
}

export function buildFileOperationCardData(
  invocation: ToolInvocationSource,
): FileOperationCardData | null {
  if (!FILE_TOOL_NAMES.has(invocation.toolName)) {
    return null;
  }
  if (invocation.toolName === "file_change") {
    return buildFileChangeCardData(invocation);
  }
  if (invocation.toolName === "read_file") {
    return buildReadFileCardData(invocation);
  }
  if (invocation.toolName === "write_file") {
    return buildWriteFileCardData(invocation);
  }
  if (invocation.toolName === "edit_file") {
    return buildEditFileCardData(invocation);
  }
  if (invocation.toolName === "apply_patch") {
    return buildApplyPatchCardData(invocation);
  }
  return null;
}
