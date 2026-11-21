import { mkdtempSync, readFileSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { UserProfileStore } from "./user-profile.store.js";

const makeWorkspace = (): string => mkdtempSync(join(tmpdir(), "np-profile-"));

const cleanup = (dir: string): void => {
  rmSync(dir, { recursive: true, force: true });
};

describe("UserProfileStore", () => {
  it("starts empty and reports no profile", () => {
    const ws = makeWorkspace();
    try {
      const store = new UserProfileStore(ws);
      expect(store.hasProfile()).toBe(false);
      expect(store.readProfile()).toBe("");
      expect(store.listCandidates()).toEqual([]);
    } finally {
      cleanup(ws);
    }
  });

  it("writes and reads an approved profile", () => {
    const ws = makeWorkspace();
    try {
      const store = new UserProfileStore(ws);
      store.writeProfile("# 画像\n\n## Preferences\n- 中文回复\n");
      expect(store.hasProfile()).toBe(true);
      expect(store.readProfile()).toContain("中文回复");
    } finally {
      cleanup(ws);
    }
  });

  it("appends a candidate and persists it for later listing", () => {
    const ws = makeWorkspace();
    try {
      const store = new UserProfileStore(ws);
      const created = store.appendCandidate({
        section: "identity",
        entry: "称呼：阿算",
        source: "session:abc",
      });
      expect(created).not.toBeNull();
      expect(created?.section).toBe("identity");
      expect(store.listCandidates()).toHaveLength(1);

      const reopened = new UserProfileStore(ws);
      expect(reopened.listCandidates()).toHaveLength(1);
      expect(reopened.listCandidates()[0].entry).toBe("称呼：阿算");
    } finally {
      cleanup(ws);
    }
  });

  it("deduplicates identical candidates in the same section", () => {
    const ws = makeWorkspace();
    try {
      const store = new UserProfileStore(ws);
      store.appendCandidate({ section: "identity", entry: "称呼：阿算", source: "s1" });
      const duplicate = store.appendCandidate({
        section: "identity",
        entry: "称呼：阿算",
        source: "s2",
      });
      expect(duplicate).toBeNull();
      expect(store.listCandidates()).toHaveLength(1);
    } finally {
      cleanup(ws);
    }
  });

  it("approves a candidate by merging into the matching profile section", () => {
    const ws = makeWorkspace();
    try {
      const store = new UserProfileStore(ws);
      const candidate = store.appendCandidate({
        section: "preferences",
        entry: "发布前先跑 staging 验证",
        source: "session:rel-1",
      });
      expect(candidate).not.toBeNull();
      const approved = store.approveCandidate(candidate!.id);
      expect(approved?.entry).toBe("发布前先跑 staging 验证");
      // 候选项已移除
      expect(store.listCandidates()).toHaveLength(0);
      // 画像文件生成对应小节与条目
      const profile = store.readProfile();
      expect(profile).toContain("## Preferences");
      expect(profile).toContain("发布前先跑 staging 验证");
      expect(profile).toContain("session:rel-1");
    } finally {
      cleanup(ws);
    }
  });

  it("approving an unknown candidate returns null", () => {
    const ws = makeWorkspace();
    try {
      const store = new UserProfileStore(ws);
      expect(store.approveCandidate("nope")).toBeNull();
    } finally {
      cleanup(ws);
    }
  });

  it("rejects a candidate without touching the profile", () => {
    const ws = makeWorkspace();
    try {
      const store = new UserProfileStore(ws);
      store.writeProfile("## Boundaries\n- 不读私人目录\n");
      const candidate = store.appendCandidate({
        section: "boundaries",
        entry: "不自动发布",
        source: "session:b",
      });
      expect(candidate).not.toBeNull();
      expect(store.rejectCandidate(candidate!.id)).toBe(true);
      expect(store.listCandidates()).toHaveLength(0);
      expect(store.readProfile()).not.toContain("不自动发布");
      expect(store.rejectCandidate(candidate!.id)).toBe(false);
    } finally {
      cleanup(ws);
    }
  });

  it("candidate file is omitted when no candidates remain", () => {
    const ws = makeWorkspace();
    try {
      const store = new UserProfileStore(ws);
      store.appendCandidate({ section: "identity", entry: "称呼：阿算", source: "s" });
      expect(existsSync(join(ws, "USER.candidates.md"))).toBe(true);
      const c = store.listCandidates()[0];
      store.rejectCandidate(c.id);
      expect(existsSync(join(ws, "USER.candidates.md"))).toBe(false);
    } finally {
      cleanup(ws);
    }
  });

  it("does not read from pinned.md (profile stays independent)", () => {
    const ws = makeWorkspace();
    try {
      writeFileSync(join(ws, "pinned.md"), "## Pinned\n- 最高优先级事实\n", "utf-8");
      const store = new UserProfileStore(ws);
      expect(store.readProfile()).toBe("");
    } finally {
      cleanup(ws);
    }
  });

  it("persists multi-line file content verbatim on write", () => {
    const ws = makeWorkspace();
    try {
      const store = new UserProfileStore(ws);
      const content = "## Identity\n- 称呼：阿算\n\n## Boundaries\n- 不删数据\n";
      store.writeProfile(content);
      expect(readFileSync(join(ws, "USER.md"), "utf-8")).toBe(content);
    } finally {
      cleanup(ws);
    }
  });
});
