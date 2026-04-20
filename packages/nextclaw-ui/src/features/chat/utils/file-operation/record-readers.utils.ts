import { readPartialJsonStringField } from "../chat-message-partial-json.utils";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readNonEmptyString(value: unknown): string | null {
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

function readPositiveInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  return null;
}

export function readRecordPayload(
  value: unknown,
): Record<string, unknown> | null {
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

export function readPartialRecordPayload(
  value: unknown,
): Record<string, unknown> | null {
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
    readPartialJsonStringField(trimmed, [
      "content",
      "text",
      "afterText",
      "after_text",
    ])?.value ?? null;
  const oldText =
    readPartialJsonStringField(trimmed, [
      "oldText",
      "beforeText",
      "before_text",
    ])?.value ?? null;
  const newText =
    readPartialJsonStringField(trimmed, ["newText", "afterText", "after_text"])
      ?.value ?? null;
  const patch =
    readPartialJsonStringField(trimmed, [
      "patch",
      "diff",
      "unifiedDiff",
      "unified_diff",
    ])?.value ?? null;

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

export function readPath(record: Record<string, unknown>): string | null {
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

export function readOperation(record: Record<string, unknown>): string | null {
  return (
    readNonEmptyString(record.operation) ??
    readNonEmptyString(record.op) ??
    readNonEmptyString(record.action) ??
    readNonEmptyString(record.kind) ??
    readNonEmptyString(record.type) ??
    readNonEmptyString(record.status)
  );
}

function readLineStart(
  record: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = readPositiveInteger(record[key]);
    if (value !== null) {
      return value;
    }
  }
  return null;
}

export function readOldStartLine(
  record: Record<string, unknown>,
): number | null {
  return readLineStart(record, [
    "oldStartLine",
    "old_start_line",
    "startOldLine",
    "start_old_line",
    "oldLineStart",
    "old_line_start",
    "oldLineNumber",
    "old_line_number",
    "lineStart",
    "line_start",
    "startLine",
    "start_line",
    "lineNumber",
    "line_number",
  ]);
}

export function readNewStartLine(
  record: Record<string, unknown>,
): number | null {
  return readLineStart(record, [
    "newStartLine",
    "new_start_line",
    "startNewLine",
    "start_new_line",
    "newLineStart",
    "new_line_start",
    "newLineNumber",
    "new_line_number",
    "lineStart",
    "line_start",
    "startLine",
    "start_line",
    "lineNumber",
    "line_number",
  ]);
}

export function readPatchText(record: Record<string, unknown>): string | null {
  return (
    readNonEmptyString(record.patch) ??
    readNonEmptyString(record.diff) ??
    readNonEmptyString(record.unifiedDiff) ??
    readNonEmptyString(record.unified_diff)
  );
}

export function readBeforeText(record: Record<string, unknown>): string | null {
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

export function readAfterText(record: Record<string, unknown>): string | null {
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
