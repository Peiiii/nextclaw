import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ensureDir, todayDate } from "../utils/helpers.js";

export class MemoryStore {
  private memoryDir: string;
  private memoryFile: string;

  constructor(private workspace: string) {
    this.memoryDir = ensureDir(join(workspace, "memory"));
    this.memoryFile = join(this.memoryDir, "MEMORY.md");
  }

  getTodayFile(): string {
    return join(this.memoryDir, `${todayDate()}.md`);
  }

  readToday(): string {
    const todayFile = this.getTodayFile();
    if (existsSync(todayFile)) {
      return readFileSync(todayFile, "utf-8");
    }
    return "";
  }

  appendToday(content: string): void {
    const todayFile = this.getTodayFile();
    let nextContent = content;
    if (existsSync(todayFile)) {
      const existing = readFileSync(todayFile, "utf-8");
      nextContent = `${existing}\n${content}`;
    } else {
      const header = `# ${todayDate()}\n\n`;
      nextContent = header + content;
    }
    writeFileSync(todayFile, nextContent, "utf-8");
  }

  readLongTerm(): string {
    if (existsSync(this.memoryFile)) {
      return readFileSync(this.memoryFile, "utf-8");
    }
    return "";
  }

  writeLongTerm(content: string): void {
    writeFileSync(this.memoryFile, content, "utf-8");
  }

  getRecentMemories(days = 7): string {
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
  }

  listMemoryFiles(): string[] {
    if (!existsSync(this.memoryDir)) {
      return [];
    }
    return readdirSync(this.memoryDir)
      .filter((name) => /^\d{4}-\d{2}-\d{2}\.md$/.test(name))
      .sort()
      .reverse()
      .map((name) => join(this.memoryDir, name));
  }

  getMemoryContext(): string {
    const parts: string[] = [];
    const longTerm = this.readLongTerm();
    if (longTerm) {
      parts.push(`## Long-term Memory\n${longTerm}`);
    }
    const today = this.readToday();
    if (today) {
      parts.push(`## Today's Notes\n${today}`);
    }
    return parts.length ? parts.join("\n\n") : "";
  }
}
