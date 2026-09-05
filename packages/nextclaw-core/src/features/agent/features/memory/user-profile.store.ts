import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensureDir, todayDate } from "@core/shared/lib/core-utils/index.js";

/**
 * 使用人画像 store（issue #41 PR-1）。
 *
 * 每个分身 workspace 维护两个文件：
 * - `USER.md`：已审批生效的使用人画像（称呼/稳定偏好/边界）。
 * - `USER.candidates.md`：Auto-Capture 产出的画像候选队列（写前审批，
 *   审批通过才并入 USER.md，防止自动沉淀污染画像）。
 *
 * 画像与 pinned 的关系：pinned.md（已冻结 persona-pinned-layer 设计）是
 * 使用者显式固定的最高优先级事实，覆盖画像自动推断；本 store 不读取 pinned。
 */
export type UserProfileSection = "identity" | "preferences" | "boundaries";

export const USER_PROFILE_SECTIONS: readonly UserProfileSection[] = [
  "identity",
  "preferences",
  "boundaries",
] as const;

export interface UserProfileCandidate {
  /** 稳定 id（写入 candidates 时生成） */
  id: string;
  /** 画像小节归属 */
  section: UserProfileSection;
  /** 一句话画像条目（如 "称呼：阿算"） */
  entry: string;
  /** 来源（session key 或记忆文件路径） */
  source: string;
  /** 创建时间 ISO */
  createdAt: string;
}

const CANDIDATE_BLOCK_SEPARATOR = "\n---\n";

const parseCandidateBlocks = (raw: string): UserProfileCandidate[] => {
  const text = raw.trim();
  if (!text) {
    return [];
  }
  return text
    .split(CANDIDATE_BLOCK_SEPARATOR)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n");
      const candidate: Partial<UserProfileCandidate> = {};
      for (const line of lines) {
        const match = /^([a-zA-Z]+):\s*(.+)$/.exec(line);
        if (!match) {
          continue;
        }
        const key = match[1] as keyof UserProfileCandidate;
        const value = match[2].trim();
        if (key === "section" && isProfileSection(value)) {
          candidate.section = value;
        } else if (key === "id") {
          candidate.id = value;
        } else if (key === "entry") {
          candidate.entry = value;
        } else if (key === "source") {
          candidate.source = value;
        } else if (key === "createdAt") {
          candidate.createdAt = value;
        }
      }
      return candidate as UserProfileCandidate;
    })
    .filter((candidate) => Boolean(candidate.id && candidate.entry));
};

const isProfileSection = (value: string): value is UserProfileSection =>
  (USER_PROFILE_SECTIONS as readonly string[]).includes(value);

const serializeCandidateBlocks = (
  candidates: readonly UserProfileCandidate[],
): string =>
  candidates
    .map(
      (candidate) =>
        `id: ${candidate.id}\nsection: ${candidate.section}\nentry: ${candidate.entry}\nsource: ${candidate.source}\ncreatedAt: ${candidate.createdAt}`,
    )
    .join(CANDIDATE_BLOCK_SEPARATOR);

const readTextIfExists = (path: string): string =>
  existsSync(path) ? readFileSync(path, "utf-8") : "";

export class UserProfileStore {
  private readonly profileFile: string;
  private readonly candidatesFile: string;

  constructor(workspace: string) {
    ensureDir(workspace);
    this.profileFile = join(workspace, "USER.md");
    this.candidatesFile = join(workspace, "USER.candidates.md");
  }

  /** 已审批生效的画像原文（无文件时为空串）。 */
  readProfile = (): string => readTextIfExists(this.profileFile);

  /** 写入整份已生效画像（仅审批动作调用；不覆盖 pinned.md）。 */
  writeProfile = (content: string): void => {
    writeFileSync(this.profileFile, content, "utf-8");
  };

  /** 画像文件是否存在。 */
  hasProfile = (): boolean => existsSync(this.profileFile);

  /** 候选队列原文（无文件时为空串）。 */
  readCandidatesRaw = (): string => readTextIfExists(this.candidatesFile);

  /** 解析后的候选列表。 */
  listCandidates = (): UserProfileCandidate[] =>
    parseCandidateBlocks(readTextIfExists(this.candidatesFile));

  /** 队列空时删除候选文件，避免空文件残留。 */
  private persistCandidates = (candidates: readonly UserProfileCandidate[]): void => {
    if (candidates.length === 0) {
      if (existsSync(this.candidatesFile)) {
        unlinkSync(this.candidatesFile);
      }
      return;
    }
    writeFileSync(this.candidatesFile, `${serializeCandidateBlocks(candidates)}\n`, "utf-8");
  };

  /**
   * 追加一条画像候选（Auto-Capture 产出，不自动生效）。
   * 返回生成候选；重复 entry 去重（同一 section 已存在则返回 null）。
   */
  appendCandidate = (
    input: Pick<UserProfileCandidate, "section" | "entry" | "source">,
  ): UserProfileCandidate | null => {
    const existing = this.listCandidates();
    if (
      existing.some(
        (candidate) =>
          candidate.section === input.section &&
          candidate.entry.trim() === input.entry.trim(),
      )
    ) {
      return null;
    }
    const candidate: UserProfileCandidate = {
      id: randomUUID(),
      section: input.section,
      entry: input.entry.trim(),
      source: input.source,
      createdAt: new Date().toISOString(),
    };
    this.persistCandidates([...existing, candidate]);
    return candidate;
  };

  /**
   * 审批通过指定候选：把条目并入 USER.md 对应小节，并从候选队列移除。
   * 返回被并入的候选；不存在返回 null。
   */
  approveCandidate = (candidateId: string): UserProfileCandidate | null => {
    const existing = this.listCandidates();
    const candidate = existing.find((item) => item.id === candidateId);
    if (!candidate) {
      return null;
    }
    const rest = existing.filter((item) => item.id !== candidateId);
    this.persistCandidates(rest);

    const profile = readTextIfExists(this.profileFile);
    const heading = this.sectionHeading(candidate.section);
    const entryLine = `- ${candidate.entry} (source: ${candidate.source}, ${candidate.createdAt.slice(0, 10)})`;
    let nextProfile: string;
    const headingIndex = profile.split("\n").findIndex((line) => line.trim() === heading);
    if (headingIndex >= 0) {
      const lines = profile.split("\n");
      lines.splice(headingIndex + 1, 0, entryLine);
      nextProfile = lines.join("\n");
    } else {
      const header = profile.trim() ? `\n\n` : "";
      nextProfile = `${profile.trim()}${header}${heading}\n${entryLine}\n`;
    }
    writeFileSync(this.profileFile, nextProfile.trimEnd() + "\n", "utf-8");
    return candidate;
  };

  /** 拒绝候选：仅从队列移除，不写入画像。返回是否移除成功。 */
  rejectCandidate = (candidateId: string): boolean => {
    const existing = this.listCandidates();
    const rest = existing.filter((item) => item.id !== candidateId);
    if (rest.length === existing.length) {
      return false;
    }
    this.persistCandidates(rest);
    return true;
  };

  private sectionHeading = (section: UserProfileSection): string =>
    `## ${section[0].toUpperCase()}${section.slice(1)}`;

  /** 今日日期（测试/审计辅助）。 */
  readonly today = todayDate();
}
