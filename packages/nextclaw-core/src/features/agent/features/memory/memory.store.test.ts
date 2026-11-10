import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MemoryStore } from "./memory.store.js";

const makeWorkspace = (): string => mkdtempSync(join(tmpdir(), "np-memory-"));

const cleanup = (dir: string): void => {
  rmSync(dir, { recursive: true, force: true });
};

describe("MemoryStore digest + source hash", () => {
  it("writes a digest card with frontmatter and lists it back", () => {
    const ws = makeWorkspace();
    try {
      const store = new MemoryStore(ws);
      const path = store.writeDigestCard("procedure", {
        name: "staging verification",
        description: "发布前先验证 staging",
        source: "session:rel-1",
        body: "任何生产发布都应先执行 staging 验证。",
      });
      expect(path).toContain(join("memory", "digest", "procedure"));
      expect(existsSync(path)).toBe(true);

      const listed = store.listDigestCards("procedure");
      expect(listed).toHaveLength(1);

      const content = store.readDigestCard("procedure", "staging verification");
      expect(content).toContain("name: staging verification");
      expect(content).toContain("description: 发布前先验证 staging");
      expect(content).toContain("source: session:rel-1");
      expect(content).toContain("任何生产发布都应先执行 staging 验证。");
    } finally {
      cleanup(ws);
    }
  });

  it("sanitizes card file names and keeps Chinese", () => {
    const ws = makeWorkspace();
    try {
      const store = new MemoryStore(ws);
      const path = store.writeDigestCard("wiki", {
        name: "生产发布约定!@#",
        description: "desc",
        source: "s",
        body: "body",
      });
      expect(path.endsWith("生产发布约定.md")).toBe(true);
    } finally {
      cleanup(ws);
    }
  });

  it("reads an unknown digest card as empty", () => {
    const ws = makeWorkspace();
    try {
      const store = new MemoryStore(ws);
      expect(store.readDigestCard("personal", "missing")).toBe("");
      expect(store.listDigestCards("personal")).toEqual([]);
    } finally {
      cleanup(ws);
    }
  });

  it("hashes a source key deterministically and one-way", () => {
    const ws = makeWorkspace();
    try {
      const store = new MemoryStore(ws);
      const a = store.hashSource("session:abc");
      const b = store.hashSource("session:abc");
      const c = store.hashSource("session:abd");
      expect(a).toBe(b);
      expect(a).toHaveLength(32);
      expect(a).not.toBe(c);
    } finally {
      cleanup(ws);
    }
  });

  it("lists all memory markdown files including digest subdirectories", () => {
    const ws = makeWorkspace();
    try {
      const store = new MemoryStore(ws);
      writeFileSync(join(ws, "memory", "2026-09-01.md"), "# day\n", "utf-8");
      store.writeDigestCard("personal", {
        name: "user-notes",
        description: "notes",
        source: "s",
        body: "body",
      });
      store.writeDigestCard("wiki", {
        name: "concept",
        description: "c",
        source: "s",
        body: "b",
      });
      const files = store.listAllMemoryFiles();
      expect(files.some((f) => f.endsWith("2026-09-01.md"))).toBe(true);
      expect(files.some((f) => f.endsWith(join("digest", "personal", "user-notes.md")))).toBe(true);
      expect(files.some((f) => f.endsWith(join("digest", "wiki", "concept.md")))).toBe(true);
      // index 目录（若有）不入列表
      expect(files.some((f) => f.includes(join("memory", "index")))).toBe(false);
    } finally {
      cleanup(ws);
    }
  });

  it("keeps legacy workspace MEMORY.md and memory/*.md readable", () => {
    const ws = makeWorkspace();
    try {
      writeFileSync(join(ws, "MEMORY.md"), "# legacy long-term\n", "utf-8");
      mkdirSync(join(ws, "memory"), { recursive: true });
      writeFileSync(join(ws, "memory", "MEMORY.md"), "# memory long-term\n", "utf-8");
      const store = new MemoryStore(ws);
      expect(store.readWorkspaceMemory()).toContain("legacy");
      expect(store.readLongTerm()).toContain("memory long-term");
      expect(readdirSync(join(ws, "memory")).some((n) => n.endsWith(".md"))).toBe(true);
    } finally {
      cleanup(ws);
    }
  });
});
