import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { ensureDir, todayDate } from "@core/shared/lib/core-utils/index.js";

const readTextIfExists = (path: string): string => (existsSync(path) ? readFileSync(path, "utf-8") : "");

export type DigestCategory = "personal" | "procedure" | "wiki";

export const DIGEST_CATEGORIES: readonly DigestCategory[] = [
  "personal",
  "procedure",
  "wiki",
] as const;

export interface MemoryCard {
  /** 卡片名（digest 节点名或每日记忆标题） */
  name: string;
  /** 一句话摘要 */
  description: string;
  /** 来源：会话 key 或相对记忆文件路径 */
  source: string;
  /** 卡片正文 */
  body: string;
}

const isDigestCategory = (value: string): value is DigestCategory =>
  (DIGEST_CATEGORIES as readonly string[]).includes(value);

const safeName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "untitled";

const frontmatter = (card: MemoryCard): string =>
  [
    "---",
    `name: ${card.name}`,
    `description: ${card.description.replace(/\n/g, " ")}`,
    `source: ${card.source}`,
    "---",
  ].join("\n");

const writeTextFile = (path: string, content: string): void => {
  mkdirSync(path.slice(0, path.lastIndexOf("/")), { recursive: true });
  writeFileSync(path, content, "utf-8");
};

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

  /** 将来源会话 key 哈希为固定长度标识（用于追溯目录命名，单向映射）。 */
  hashSource = (key: string): string => createHash("sha256").update(key).digest("hex").slice(0, 32);

  /** 在 memory/digest/<category>/ 写入一张带 frontmatter 的长期卡片。 */
  writeDigestCard = (category: DigestCategory, card: MemoryCard): string => {
    const digestDir = join(this.memoryDir, "digest", category);
    const filePath = join(digestDir, `${safeName(card.name)}.md`);
    const content = `${frontmatter(card)}\n\n${card.body.trim()}\n`;
    writeTextFile(filePath, content);
    return filePath;
  };

  /** 列出 digest 某分类下全部卡片路径（未写任何卡片时为空）。 */
  listDigestCards = (category: DigestCategory): string[] => {
    const dir = join(this.memoryDir, "digest", category);
    if (!existsSync(dir)) {
      return [];
    }
    return readdirSync(dir)
      .filter((name) => name.endsWith(".md"))
      .sort()
      .map((name) => join(dir, name));
  };

  /** 读取 digest 卡片原始内容；目录分类非法时返回空串。 */
  readDigestCard = (category: DigestCategory, name: string): string =>
    readTextIfExists(join(this.memoryDir, "digest", category, `${safeName(name)}.md`));

  /** 在当前分身 workspace 内递归列出全部记忆文件（含 digest），供 CLI/list 审计。 */
  listAllMemoryFiles = (): string[] => {
    const files: string[] = [];
    const walk = (dir: string): void => {
      if (!existsSync(dir)) {
        return;
      }
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
        } else if (entry.endsWith(".md")) {
          files.push(full);
        }
      }
    };
    walk(this.memoryDir);
    return files.sort();
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
