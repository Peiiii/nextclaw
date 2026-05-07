import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { Tool } from "./base.js";

const DEFAULT_LIMIT = 20;
const DEFAULT_CONTEXT_LINES = 0;

const toInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallback;
};

const normalizeQuery = (value: unknown): string => String(value ?? "").trim();

const isWithin = (child: string, parent: string): boolean => {
  const resolvedChild = resolve(child);
  const resolvedParent = resolve(parent);
  return resolvedChild === resolvedParent || resolvedChild.startsWith(`${resolvedParent}/`);
};

const getMemoryFiles = (workspace: string): string[] => {
  const files: string[] = [];
  const workspaceMemory = join(workspace, "MEMORY.md");
  if (existsSync(workspaceMemory)) {
    files.push(workspaceMemory);
  }
  const memoryDir = join(workspace, "memory");
  if (existsSync(memoryDir)) {
    const entries = readdirSync(memoryDir);
    for (const entry of entries) {
      if (!entry.endsWith(".md")) {
        continue;
      }
      files.push(join(memoryDir, entry));
    }
  }
  return files;
};

export class MemorySearchTool extends Tool {
  constructor(private workspace: string) {
    super();
  }

  get name(): string {
    return "memory_search";
  }

  get description(): string {
    return "Mandatory recall step: search MEMORY.md + memory/*.md; returns snippets with path + lines.";
  }

  get parameters(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        maxResults: { type: "integer", minimum: 1, description: "Maximum number of matches to return" },
        minScore: { type: "number", description: "Minimum score (ignored for local search)" }
      },
      required: ["query"]
    };
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const query = normalizeQuery(params.query);
    if (!query) {
      return "Error: query is required";
    }
    const limit = toInt(params.maxResults ?? params.limit, DEFAULT_LIMIT);
    const contextLines = toInt(params.contextLines, DEFAULT_CONTEXT_LINES);
    const lowerQuery = query.toLowerCase();
    const results: Array<{ path: string; line: number; text: string; score: number }> = [];
    const files = getMemoryFiles(this.workspace);
    for (const filePath of files) {
      const content = readFileSync(filePath, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i += 1) {
        if (lines[i].toLowerCase().includes(lowerQuery)) {
          const start = Math.max(0, i - contextLines);
          const end = Math.min(lines.length, i + contextLines + 1);
          const snippet = lines.slice(start, end).join("\n");
          results.push({ path: filePath, line: i + 1, text: snippet, score: 1 });
          if (results.length >= limit) {
            return JSON.stringify(
              { results, provider: "local", model: "regex", fallback: false, citations: "off" },
              null,
              2
            );
          }
        }
      }
    }
    return JSON.stringify(
      { results, provider: "local", model: "regex", fallback: false, citations: "off" },
      null,
      2
    );
  }
}

export class MemoryGetTool extends Tool {
  constructor(private workspace: string) {
    super();
  }

  get name(): string {
    return "memory_get";
  }

  get description(): string {
    return "Safe snippet read from MEMORY.md or memory/*.md; use after memory_search.";
  }

  get parameters(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to memory file (relative or absolute)" },
        from: { type: "integer", minimum: 1, description: "Start line (1-based)" },
        lines: { type: "integer", minimum: 1, description: "Number of lines to read" }
      },
      required: ["path"]
    };
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const pathParam = String(params.path ?? "").trim();
    if (!pathParam) {
      return "Error: path is required";
    }
    const resolvedPath = resolve(this.workspace, pathParam);
    const memoryDir = join(this.workspace, "memory");
    const workspaceMemory = join(this.workspace, "MEMORY.md");
    if (!isWithin(resolvedPath, this.workspace)) {
      return "Error: path must be within workspace";
    }
    if (!(resolvedPath === resolve(workspaceMemory) || isWithin(resolvedPath, memoryDir))) {
      return "Error: path must be MEMORY.md or memory/*.md within workspace";
    }
    if (!existsSync(resolvedPath)) {
      return `Error: file not found: ${resolvedPath}`;
    }
    const content = readFileSync(resolvedPath, "utf-8");
    const lines = content.split("\n");
    const startLine = toInt(params.from ?? params.startLine, 1);
    const requestedLines = toInt(params.lines ?? params.endLine, Math.max(lines.length - startLine + 1, 1));
    const endLine = Math.min(lines.length, startLine + requestedLines - 1);
    const startIdx = Math.max(0, startLine - 1);
    const endIdx = Math.min(lines.length, endLine);
    const selected = lines.slice(startIdx, endIdx);
    const numbered = selected.map((line, idx) => `${startIdx + idx + 1}: ${line}`);
    return JSON.stringify(
      { path: pathParam, from: startLine, lines: endIdx - startIdx, text: numbered.join("\n") },
      null,
      2
    );
  }
}
