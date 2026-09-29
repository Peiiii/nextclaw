import type { NcpTool } from "@nextclaw/ncp";

export { createWorkspaceByteTools } from "./workspace-byte.tools.js";

export type WorkspaceFileEntry = { name: string; directory: boolean; bytes?: number };
export type WorkspaceFileSnapshot = { content: string; version?: number };

/** The host owns path confinement and persistence; tool semantics stay in the Kernel. */
export type WorkspaceFilePort = {
  resolve(path: string): string;
  read(path: string): Promise<WorkspaceFileSnapshot | null>;
  write(path: string, content: string, expectedVersion?: number): Promise<void>;
  list(path: string): Promise<readonly WorkspaceFileEntry[] | null>;
};

const READ_LIMIT = 2_000;
const MAX_LINE_LENGTH = 2_000;
const MAX_BYTES = 50 * 1_024;

function args(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { return {}; }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function schema(properties: Record<string, unknown>, required: readonly string[]) {
  return { type: "object", properties, required };
}

function validate(value: Record<string, unknown>, required: readonly string[], allowed: readonly string[]): string[] {
  const issues: string[] = [];
  for (const key of required) if (typeof value[key] !== "string") issues.push(`${key} must be a string`);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) issues.push(`${key} is not allowed`);
  return issues;
}

function positiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(1, Math.floor(value)) : fallback;
}

function pagedRead(path: string, content: string, offset: number, limit: number): string {
  const lines = content.split(/\r\n|\r|\n/);
  if (offset > lines.length) return `Error: Offset ${offset} is out of range for this file (${lines.length} lines)`;
  const output: string[] = [];
  let bytes = 0;
  let cut = false;
  for (let index = offset - 1; index < lines.length; index += 1) {
    if (output.length >= limit) break;
    const original = lines[index] ?? "";
    const line = original.length > MAX_LINE_LENGTH
      ? `${original.substring(0, MAX_LINE_LENGTH)}... (line truncated to ${MAX_LINE_LENGTH} chars)` : original;
    const size = new TextEncoder().encode(line).byteLength + (output.length ? 1 : 0);
    if (bytes + size > MAX_BYTES) { cut = true; break; }
    output.push(line);
    bytes += size;
  }
  const last = offset + output.length - 1;
  const more = last < lines.length;
  let result = `<path>${path}</path>\n<type>file</type>\n<content>\n${output.map((line, index) => `${offset + index}: ${line}`).join("\n")}`;
  if (cut) result += `\n\n(Output capped at 50 KB. Showing lines ${offset}-${last}. Use offset=${last + 1} to continue.)`;
  else if (more) result += `\n\n(Showing lines ${offset}-${last} of ${lines.length}. Use offset=${last + 1} to continue.)`;
  else result += `\n\n(End of file - total ${lines.length} lines)`;
  return `${result}\n</content>`;
}

export function createWorkspaceFileTools(port: WorkspaceFilePort): readonly NcpTool[] {
  const path = { type: "string", description: "Path to the file or directory" };
  const read: NcpTool = {
    name: "read_file", description: "Read a file from the workspace", supportsParallelToolCalls: true,
    modelParameters: schema({ path, offset: { type: "number" }, limit: { type: "number" } }, ["path"]),
    validateArgs: (value) => validate(value, ["path"], ["path", "offset", "limit"]),
    execute: async (value) => {
      const input = args(value);
      const resolved = port.resolve(String(input.path));
      const file = await port.read(resolved);
      return file ? pagedRead(resolved, file.content,
        positiveInteger(input.offset, 1), positiveInteger(input.limit, READ_LIMIT)) : `Error: File not found: ${resolved}`;
    },
  };
  const write: NcpTool = {
    name: "write_file", description: "Create or overwrite a workspace file", supportsParallelToolCalls: false,
    modelParameters: schema({ path, content: { type: "string", description: "Content to write" } }, ["path", "content"]),
    validateArgs: (value) => validate(value, ["path", "content"], ["path", "content"]),
    execute: async (value) => {
      const input = args(value);
      const resolved = port.resolve(String(input.path));
      const content = String(input.content ?? "");
      await port.write(resolved, content);
      return `Wrote ${content.length} bytes to ${resolved}`;
    },
  };
  const edit: NcpTool = {
    name: "edit_file", description: "Edit a workspace file by replacing a string", supportsParallelToolCalls: false,
    modelParameters: schema({ path, oldText: { type: "string" }, newText: { type: "string" } }, ["path", "oldText", "newText"]),
    validateArgs: (value) => validate(value, ["path", "oldText", "newText"], ["path", "oldText", "newText"]),
    execute: async (value) => {
      const input = args(value);
      const requested = String(input.path);
      const resolved = port.resolve(requested);
      const file = await port.read(resolved);
      if (!file) return `Error: File not found: ${resolved}`;
      const oldText = String(input.oldText ?? "");
      const index = file.content.indexOf(oldText);
      if (index < 0) return "Error: Text to replace not found";
      const line = file.content.slice(0, index).split(/\r\n|\r|\n/).length;
      await port.write(resolved, file.content.replace(oldText, String(input.newText ?? "")), file.version);
      return { path: requested, oldStartLine: line, newStartLine: line, message: `Edited ${resolved}` };
    },
  };
  const list: NcpTool = {
    name: "list_dir", description: "List workspace directory entries", supportsParallelToolCalls: true,
    modelParameters: schema({ path }, ["path"]),
    validateArgs: (value) => validate(value, ["path"], ["path"]),
    execute: async (value) => {
      const resolved = port.resolve(String(args(value).path));
      const entries = await port.list(resolved);
      if (!entries) return `Error: Directory not found: ${resolved}`;
      return entries.map((entry) => `${entry.name}${entry.directory ? "/" : ""}${entry.bytes === undefined ? "" : ` (${entry.bytes} bytes)`}`).join("\n") || "(empty)";
    },
  };
  return [read, write, edit, list];
}
