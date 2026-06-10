import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ensureDir, todayDate } from "../../../../shared/lib/core-utils/utils/helpers.utils.js";

const readTextIfExists = (path: string): string => (existsSync(path) ? readFileSync(path, "utf-8") : "");

export class MemoryStore {
  private memoryDir: string;
  private memoryFile: string;
  private workspaceMemoryFile: string;

  constructor(private workspace: string) {
    this.memoryDir = ensureDir(join(workspace, "memory"));
    this.memoryFile = join(this.memoryDir, "MEMORY.md");
    this.workspaceMemoryFile = join(workspace, "MEMORY.md");
  }

  getTodayFile = (): string => join(this.memoryDir, `${todayDate()}.md`);

  readToday = (): string => readTextIfExists(this.getTodayFile());

  appendToday = (content: string): void => {
    const todayFile = this.getTodayFile();
    const prefix = existsSync(todayFile) ? `${readTextIfExists(todayFile)}\n` : `# ${todayDate()}\n\n`;
    writeFileSync(todayFile, `${prefix}${content}`, "utf-8");
  };

  readLongTerm = (): string => {
    return readTextIfExists(this.memoryFile);
  };

  readWorkspaceMemory = (): string => {
    return readTextIfExists(this.workspaceMemoryFile);
  };

  writeLongTerm = (content: string): void => {
    writeFileSync(this.memoryFile, content, "utf-8");
  };

  getRecentMemories = (days = 7): string => {
    const memories: string[] = [];
    const today = new Date();
    for (let i = 0; i < days; i += 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().slice(0, 10);
      const path = join(this.memoryDir, `${dateStr}.md`);
      if (existsSync(path)) {
        memories.push(readFileSync(path, "utf-8"));
      }
    }
    return memories.length ? memories.join("\n\n---\n\n") : "";
  };

  listMemoryFiles = (): string[] => {
    if (!existsSync(this.memoryDir)) {
      return [];
    }
    return readdirSync(this.memoryDir)
      .filter((name) => /^\d{4}-\d{2}-\d{2}\.md$/.test(name))
      .sort()
      .reverse()
      .map((name) => join(this.memoryDir, name));
  };

  getMemoryContext = (): string => {
    return [
      ["Workspace Memory", this.readWorkspaceMemory()],
      ["Long-term Memory", this.readLongTerm()],
      ["Today's Notes", this.readToday()],
    ].flatMap(([title, content]) => (content ? [`## ${title}\n${content}`] : []))
      .join("\n\n");
  };
}
