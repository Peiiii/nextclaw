import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { Tool } from "./base.js";

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
        path: { type: "string", description: "Path to the file" }
      },
      required: ["path"]
    };
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const path = resolvePath(String(params.path), this.allowedDir);
    if (!existsSync(path)) {
      return `Error: File not found: ${path}`;
    }
    return readFileSync(path, "utf-8");
  }
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

  async execute(params: Record<string, unknown>): Promise<string> {
    const path = resolvePath(String(params.path), this.allowedDir);
    const content = String(params.content ?? "");
    const dir = dirname(path);
    if (!existsSync(dir)) {
      throw new Error("Directory does not exist");
    }
    writeFileSync(path, content, "utf-8");
    return `Wrote ${content.length} bytes to ${path}`;
  }
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

  async execute(params: Record<string, unknown>): Promise<string> {
    const path = resolvePath(String(params.path), this.allowedDir);
    if (!existsSync(path)) {
      return `Error: File not found: ${path}`;
    }
    const oldText = String(params.oldText ?? "");
    const newText = String(params.newText ?? "");
    const content = readFileSync(path, "utf-8");
    if (!content.includes(oldText)) {
      return "Error: Text to replace not found";
    }
    const updated = content.replace(oldText, newText);
    writeFileSync(path, updated, "utf-8");
    return `Edited ${path}`;
  }
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

  async execute(params: Record<string, unknown>): Promise<string> {
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
  }
}
