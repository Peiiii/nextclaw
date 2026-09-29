import type { NcpTool } from "@nextclaw/ncp";
import type { WorkspaceByteStore } from "@kernel/stores/workspace.store.js";

const READ_LINES = 2_000;
const LINE_CHARS = 2_000;
const OUTPUT_BYTES = 50 * 1_024;
const encoder = new TextEncoder();

function input(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { return {}; }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function validate(value: Record<string, unknown>, required: readonly string[], allowed: readonly string[]): string[] {
  const issues: string[] = [];
  for (const key of required) if (typeof value[key] !== "string") issues.push(`${key} must be a string`);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) issues.push(`${key} is not allowed`);
  return issues;
}

function integer(value: unknown, fallback: number, maximum = Number.MAX_SAFE_INTEGER): number {
  return typeof value === "number" && Number.isSafeInteger(value) ? Math.min(maximum, Math.max(1, value)) : fallback;
}

function textBody(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({ start(controller) { controller.enqueue(encoder.encode(text)); controller.close(); } });
}

/** Consume only the portion needed for the model response; the file itself has no model-output size limit. */
async function previewLines(body: ReadableStream<Uint8Array>, offset: number, limit: number): Promise<{
  lines: string[]; last: number; total: number | null; binary: boolean;
}> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const lines: string[] = [];
  let current = "";
  let truncated = false;
  let number = 1;
  let bytes = 0;
  let previousCR = false;
  let stopped = false;
  let binary = false;
  const finish = (): void => {
    if (number >= offset) {
      const line = truncated ? `${current}... (line truncated to ${LINE_CHARS} chars)` : current;
      const size = encoder.encode(line).byteLength + (lines.length ? 1 : 0);
      if (lines.length >= limit || bytes + size > OUTPUT_BYTES) { stopped = true; return; }
      lines.push(`${number}: ${line}`);
      bytes += size;
      if (lines.length >= limit) stopped = true;
    }
    number += 1;
    current = "";
    truncated = false;
  };
  const consume = (text: string): void => {
    for (const character of text) {
      if (character === "\0") { binary = true; stopped = true; return; }
      if (character === "\n" && previousCR) { previousCR = false; continue; }
      previousCR = character === "\r";
      if (character === "\r" || character === "\n") finish();
      else if (current.length < LINE_CHARS) current += character;
      else {
        truncated = true;
        if (number >= offset) { finish(); stopped = true; }
      }
      if (stopped) return;
    }
  };
  try {
    while (!stopped) {
      const next = await reader.read();
      if (next.done) {
        try { consume(decoder.decode()); }
        catch { binary = true; stopped = true; }
        if (!stopped) finish();
        return { lines, last: number - 1, total: stopped ? null : number - 1, binary };
      }
      try { consume(decoder.decode(next.value, { stream: true })); }
      catch { binary = true; stopped = true; }
    }
    await reader.cancel();
    return { lines, last: offset + lines.length - 1, total: null, binary };
  } finally { reader.releaseLock(); }
}

function countLines(text: string, state: { line: number; previousCR: boolean }): void {
  for (const char of text) {
    if (char === "\n" && state.previousCR) { state.previousCR = false; continue; }
    state.previousCR = char === "\r";
    if (char === "\r" || char === "\n") state.line += 1;
  }
}

async function findTextLine(body: ReadableStream<Uint8Array>, needle: string): Promise<number | null> {
  if (!needle) { await body.cancel(); return 1; }
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const state = { line: 1, previousCR: false };
  let pending = "";
  try {
    while (true) {
      const next = await reader.read();
      pending += next.done ? decoder.decode() : decoder.decode(next.value, { stream: true });
      const index = pending.indexOf(needle);
      if (index >= 0) {
        countLines(pending.slice(0, index), state);
        await reader.cancel();
        return state.line;
      }
      if (next.done) return null;
      const keep = Math.max(0, needle.length - 1);
      if (pending.length > keep) {
        const flushed = pending.slice(0, pending.length - keep);
        countLines(flushed, state);
        pending = pending.slice(pending.length - keep);
      }
    }
  } finally { reader.releaseLock(); }
}

function nextReplacement(pending: string, oldText: string, newText: string, ended: boolean): {
  output: string; pending: string; replaced: boolean;
} {
  const index = pending.indexOf(oldText);
  if (index >= 0) return { output: pending.slice(0, index) + newText,
    pending: pending.slice(index + oldText.length), replaced: true };
  if (ended) throw new Error("Workspace file changed during edit");
  const keep = Math.max(0, oldText.length - 1);
  if (pending.length <= keep) return { output: "", pending, replaced: false };
  return { output: pending.slice(0, pending.length - keep),
    pending: pending.slice(pending.length - keep), replaced: false };
}

async function* replacementChunks(body: ReadableStream<Uint8Array>, oldText: string,
  newText: string): AsyncGenerator<Uint8Array> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let pending = "";
  let replaced = false;
  try {
    if (!oldText) { replaced = true; yield encoder.encode(newText); }
    while (true) {
      const next = await reader.read();
      pending += next.done ? decoder.decode() : decoder.decode(next.value, { stream: true });
      if (!replaced) {
        const part = nextReplacement(pending, oldText, newText, next.done);
        pending = part.pending;
        replaced = part.replaced;
        if (part.output) yield encoder.encode(part.output);
      }
      if (replaced && pending) { yield encoder.encode(pending); pending = ""; }
      if (next.done) return;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/** Replace the first occurrence while preserving bounded memory and stream backpressure. */
function replaceText(body: ReadableStream<Uint8Array>, oldText: string, newText: string): ReadableStream<Uint8Array> {
  const iterator = replacementChunks(body, oldText, newText);
  return new ReadableStream({
    async pull(controller) {
      try {
        const next = await iterator.next();
        if (next.done) controller.close();
        else controller.enqueue(next.value);
      } catch (error) { controller.error(error); }
    },
    async cancel() { await iterator.return(undefined); },
  });
}

/** Same agent-facing file semantics for local and hosted byte stores. */
export function createWorkspaceByteTools(store: WorkspaceByteStore): readonly NcpTool[] {
  const path = { type: "string", description: "Path in the workspace" };
  const read: NcpTool = {
    name: "read_file", description: "Read lines from a workspace file", supportsParallelToolCalls: true,
    modelParameters: { type: "object", properties: { path, offset: { type: "number" }, limit: { type: "number" } }, required: ["path"] },
    validateArgs: (value) => validate(value, ["path"], ["path", "offset", "limit"]),
    execute: async (value) => {
      const args = input(value);
      const resolved = store.resolve(String(args.path));
      const file = await store.read(resolved);
      if (!file) return `Error: File not found: ${resolved}`;
      const offset = integer(args.offset, 1);
      const result = await previewLines(file.body, offset, integer(args.limit, READ_LINES, READ_LINES));
      if (result.binary) return `Error: ${resolved} is binary; use a byte-range or download tool`;
      if (result.total !== null && offset > result.total) {
        return `Error: Offset ${offset} is out of range for this file (${result.total} lines)`;
      }
      const tail = result.total === null ? `Showing lines ${offset}-${result.last}. Use offset=${result.last + 1} to continue.`
        : `End of file - total ${result.total} lines`;
      return `<path>${resolved}</path>\n<type>file</type>\n<content>\n${result.lines.join("\n")}\n\n(${tail})\n</content>`;
    },
  };
  const write: NcpTool = {
    name: "write_file", description: "Create or overwrite a workspace text file", supportsParallelToolCalls: false,
    modelParameters: { type: "object", properties: { path, content: { type: "string" } }, required: ["path", "content"] },
    validateArgs: (value) => validate(value, ["path", "content"], ["path", "content"]),
    execute: async (value) => {
      const args = input(value);
      const resolved = store.resolve(String(args.path));
      const content = String(args.content ?? "");
      await store.write(resolved, textBody(content), {
        byteLength: encoder.encode(content).byteLength, mediaType: "text/plain; charset=utf-8",
      });
      return `Wrote ${encoder.encode(content).byteLength} bytes to ${resolved}`;
    },
  };
  const edit: NcpTool = {
    name: "edit_file", description: "Replace the first exact text occurrence in a workspace file", supportsParallelToolCalls: false,
    modelParameters: { type: "object", properties: { path, oldText: { type: "string" }, newText: { type: "string" } }, required: ["path", "oldText", "newText"] },
    validateArgs: (value) => validate(value, ["path", "oldText", "newText"], ["path", "oldText", "newText"]),
    execute: async (value) => {
      const args = input(value);
      const requested = String(args.path);
      const resolved = store.resolve(requested);
      const file = await store.read(resolved);
      if (!file) return `Error: File not found: ${resolved}`;
      const oldText = String(args.oldText ?? "");
      const line = await findTextLine(file.body, oldText);
      if (line === null) return "Error: Text to replace not found";
      const source = await store.read(resolved);
      if (!source) return `Error: File not found: ${resolved}`;
      await store.write(resolved, replaceText(source.body, oldText, String(args.newText ?? "")),
        { expectedVersion: file.entry.version, mediaType: file.entry.mediaType ?? "text/plain; charset=utf-8" });
      return { path: requested, oldStartLine: line, newStartLine: line, message: `Edited ${resolved}` };
    },
  };
  const list: NcpTool = {
    name: "list_dir", description: "List one page of workspace directory entries", supportsParallelToolCalls: true,
    modelParameters: { type: "object", properties: { path, cursor: { type: "string" }, limit: { type: "number" } }, required: ["path"] },
    validateArgs: (value) => validate(value, ["path"], ["path", "cursor", "limit"]),
    execute: async (value) => {
      const args = input(value);
      const resolved = store.resolve(String(args.path));
      const page = await store.list(resolved, typeof args.cursor === "string" ? args.cursor : "", integer(args.limit, 100, 100));
      if (!page) return `Error: Directory not found: ${resolved}`;
      const entries = page.entries.map((entry) => {
        const name = entry.path.slice(entry.path.lastIndexOf("/") + 1);
        return `${name}${entry.kind === "directory" ? "/" : ""} (${entry.bytes} bytes)`;
      });
      if (page.nextCursor) entries.push(`More entries: use cursor=${JSON.stringify(page.nextCursor)}`);
      return entries.join("\n") || "(empty)";
    },
  };
  return [read, write, edit, list];
}
