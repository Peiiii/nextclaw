import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { Tool, normalizeToolParams } from "./base.tools.js";

const DEFAULT_READ_LIMIT = 2000;
const MAX_LINE_LENGTH = 2000;
const MAX_LINE_SUFFIX = `... (line truncated to ${MAX_LINE_LENGTH} chars)`;
const MAX_BYTES = 50 * 1024;
const MAX_BYTES_LABEL = `${MAX_BYTES / 1024} KB`;

type PagedReadResult = {
  raw: string[];
  count: number;
  cut: boolean;
  more: boolean;
  offset: number;
};

function resolvePath(path: string, allowedDir?: string): string {
  const resolved = resolve(path);
  if (allowedDir) {
    const allowed = resolve(allowedDir);
    if (!resolved.startsWith(allowed)) {
      throw new Error("Access denied: path outside allowed directory");
    }
  }
  return resolved;
}

function readLineNumberAtIndex(content: string, index: number): number {
  const prefix = content.slice(0, index);
  return prefix.split(/\r\n|\r|\n/).length;
}

function readNonNegativeInt(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.floor(value));
}

function readPagedLines(content: string, opts: { offset: number; limit: number }): PagedReadResult {
  const lines = content.split(/\r\n|\r|\n/);
  const start = opts.offset - 1;
  const raw: string[] = [];
  let bytes = 0;
  let cut = false;
  let more = false;

  for (let index = start; index < lines.length; index += 1) {
    if (raw.length >= opts.limit) {
      more = true;
      break;
    }

    const original = lines[index] ?? "";
    const line =
      original.length > MAX_LINE_LENGTH
        ? original.substring(0, MAX_LINE_LENGTH) + MAX_LINE_SUFFIX
        : original;
    const size = Buffer.byteLength(line, "utf-8") + (raw.length > 0 ? 1 : 0);
    if (bytes + size > MAX_BYTES) {
      cut = true;
      more = true;
      break;
    }

    raw.push(line);
    bytes += size;
  }

  return { raw, count: lines.length, cut, more, offset: opts.offset };
}

function formatPagedFileRead(path: string, file: PagedReadResult): string {
  let output = [`<path>${path}</path>`, "<type>file</type>", "<content>\n"].join("\n");
  output += file.raw.map((line, index) => `${index + file.offset}: ${line}`).join("\n");

  const last = file.offset + file.raw.length - 1;
  const next = last + 1;
  if (file.cut) {
    output += `\n\n(Output capped at ${MAX_BYTES_LABEL}. Showing lines ${file.offset}-${last}. Use offset=${next} to continue.)`;
  } else if (file.more) {
    output += `\n\n(Showing lines ${file.offset}-${last} of ${file.count}. Use offset=${next} to continue.)`;
  } else {
    output += `\n\n(End of file - total ${file.count} lines)`;
  }
  output += "\n</content>";

  return output;
}

export class ReadFileTool extends Tool {
  constructor(private allowedDir?: string) {
    super();
  }

  get name(): string {
    return "read_file";
  }

  get description(): string {
    return "Read a file from disk";
  }

  get parameters(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the file" },
        offset: { type: "number", description: "The line number to start reading from (1-indexed)" },
        limit: { type: "number", description: "The maximum number of lines to read (defaults to 2000)" }
      },
      required: ["path"]
    };
  }

  execute = async (args: unknown): Promise<string> => {
    const params = normalizeToolParams(args);
    const path = resolvePath(String(params.path), this.allowedDir);
    if (!existsSync(path)) {
      return `Error: File not found: ${path}`;
    }
    const content = readFileSync(path, "utf-8");
    const offset = readNonNegativeInt(params.offset, 1) || 1;
    const limit = readNonNegativeInt(params.limit, DEFAULT_READ_LIMIT) || DEFAULT_READ_LIMIT;
    const file = readPagedLines(content, { offset, limit });
    if (file.count < file.offset && !(file.count === 0 && file.offset === 1)) {
      return `Error: Offset ${file.offset} is out of range for this file (${file.count} lines)`;
    }
    return formatPagedFileRead(path, file);
  };
}

export class WriteFileTool extends Tool {
  constructor(private allowedDir?: string) {
    super();
  }

  get name(): string {
    return "write_file";
  }

  get description(): string {
    return "Write content to a file";
  }

  get parameters(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the file" },
        content: { type: "string", description: "Content to write" }
      },
      required: ["path", "content"]
    };
  }

  execute = async (args: unknown): Promise<string> => {
    const params = normalizeToolParams(args);
    const path = resolvePath(String(params.path), this.allowedDir);
    const content = String(params.content ?? "");
    const dir = dirname(path);
    if (!existsSync(dir)) {
      throw new Error("Directory does not exist");
    }
    writeFileSync(path, content, "utf-8");
    return `Wrote ${content.length} bytes to ${path}`;
  };
}

export class EditFileTool extends Tool {
  constructor(private allowedDir?: string) {
    super();
  }

  get name(): string {
    return "edit_file";
  }

  get description(): string {
    return "Edit a file by replacing a string";
  }

  get parameters(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the file" },
        oldText: { type: "string", description: "Text to replace" },
        newText: { type: "string", description: "Replacement text" }
      },
      required: ["path", "oldText", "newText"]
    };
  }

  execute = async (args: unknown): Promise<unknown> => {
    const params = normalizeToolParams(args);
    const requestedPath = String(params.path);
    const path = resolvePath(requestedPath, this.allowedDir);
    if (!existsSync(path)) {
      return `Error: File not found: ${path}`;
    }
    const oldText = String(params.oldText ?? "");
    const newText = String(params.newText ?? "");
    const content = readFileSync(path, "utf-8");
    const startIndex = content.indexOf(oldText);
    if (startIndex < 0) {
      return "Error: Text to replace not found";
    }
    const updated = content.replace(oldText, newText);
    writeFileSync(path, updated, "utf-8");
    const startLine = readLineNumberAtIndex(content, startIndex);
    return {
      path: requestedPath,
      oldStartLine: startLine,
      newStartLine: startLine,
      message: `Edited ${path}`
    };
  };
}

export class ListDirTool extends Tool {
  constructor(private allowedDir?: string) {
    super();
  }

  get name(): string {
    return "list_dir";
  }

  get description(): string {
    return "List files in a directory";
  }

  get parameters(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the directory" }
      },
      required: ["path"]
    };
  }

  execute = async (args: unknown): Promise<string> => {
    const params = normalizeToolParams(args);
    const path = resolvePath(String(params.path), this.allowedDir);
    if (!existsSync(path)) {
      return `Error: Directory not found: ${path}`;
    }
    const entries = readdirSync(path, { withFileTypes: true });
    const lines = entries.map((entry) => {
      const full = resolve(path, entry.name);
      const stats = statSync(full);
      return `${entry.name}${entry.isDirectory() ? "/" : ""} (${stats.size} bytes)`;
    });
    return lines.join("\n") || "(empty)";
  };
}
