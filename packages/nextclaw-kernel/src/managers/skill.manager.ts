import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import {
  SkillsLoader,
  type SkillInfo as CoreSkillInfo,
} from "@nextclaw/core";
import {
  parseSkillFrontmatter,
  stripSkillFrontmatter,
  type LocalizedTextMap,
} from "@kernel/utils/skill-frontmatter.utils.js";

export type { SkillInfo, SkillScope } from "@nextclaw/core";

type WorkspaceParams = { workspace: string };
type InstalledSkillScopeFilter = Exclude<CoreSkillInfo["scope"], "global"> | "all";

export type InstalledSkillSummary = {
  ref: string;
  name: string;
  path: string;
  relativePath: string | null;
  scope: CoreSkillInfo["scope"];
  source: CoreSkillInfo["source"];
  summary: string | null;
  summaryI18n: LocalizedTextMap | null;
  description: string | null;
  descriptionI18n: LocalizedTextMap | null;
  author: string | null;
  tags: string[];
  always: boolean;
};

export type InstalledSkillDetail = InstalledSkillSummary & {
  metadata: Record<string, string> | null;
  raw: string;
  bodyRaw: string;
};

export type InstalledSkillsList = {
  workspace: string;
  total: number;
  skills: InstalledSkillSummary[];
};

export class SkillManager {
  private readonly loader: SkillsLoader;
  private readonly workspace: string;

  constructor(params: WorkspaceParams) {
    this.workspace = resolve(params.workspace);
    this.loader = new SkillsLoader(this.workspace);
  }

  listSkills = (params: { filterUnavailable?: boolean } = {}): CoreSkillInfo[] => {
    return this.loader.listSkills(params.filterUnavailable);
  };

  getSkillInfo = (selector: string): CoreSkillInfo | null => {
    return this.loader.getSkillInfo(selector);
  };

  getSkillMetadata = (selector: string | CoreSkillInfo): Record<string, string> | null => {
    return this.loader.getSkillMetadata(selector);
  };

  loadSkillContent = (selector: string): string | null => {
    return this.loader.loadSkill(selector);
  };

  listInstalledSkills = (params: {
    query?: string;
    scope?: string;
  } = {}): InstalledSkillsList => {
    const scope = this.normalizeInstalledScope(params.scope);
    const normalizedQuery = this.normalizeOptionalString(params.query)?.toLowerCase() ?? null;

    const skills = this
      .listSkills({ filterUnavailable: false })
      .map((skill) => this.buildInstalledSkillSummary(skill))
      .filter((skill) => scope === "all" || skill.scope === scope)
      .filter((skill) => this.matchesInstalledSkillQuery(skill, normalizedQuery));

    return {
      workspace: this.workspace,
      total: skills.length,
      skills,
    };
  };

  getInstalledSkillDetail = (selector: string): InstalledSkillDetail | null => {
    const skill = this.getSkillInfo(selector);
    if (!skill) {
      return null;
    }

    const summary = this.buildInstalledSkillSummary(skill);
    const raw = readFileSync(skill.path, "utf8");
    return {
      ...summary,
      metadata: this.getSkillMetadata(skill),
      raw,
      bodyRaw: stripSkillFrontmatter(raw),
    };
  };

  findBuiltinSkill = (name: string): CoreSkillInfo | null => {
    return this
      .listSkills({ filterUnavailable: false })
      .find((skill) => skill.name === name && skill.source === "builtin") ?? null;
  };

  resolveBuiltinSkillDir = (name: string): string | null => {
    const skill = this.findBuiltinSkill(name);
    return skill ? dirname(skill.path) : null;
  };

  private buildInstalledSkillSummary = (skill: CoreSkillInfo): InstalledSkillSummary => {
    const raw = readFileSync(skill.path, "utf8");
    const metadata = this.getSkillMetadata(skill);
    const frontmatter = parseSkillFrontmatter(raw);

    return {
      ref: skill.ref,
      name: skill.name,
      path: skill.path,
      relativePath: this.buildRelativePath(skill.path),
      scope: skill.scope,
      source: skill.source,
      summary: frontmatter.summary ?? null,
      summaryI18n: frontmatter.summaryI18n ?? null,
      description: frontmatter.description ?? metadata?.description ?? null,
      descriptionI18n: frontmatter.descriptionI18n ?? null,
      author: frontmatter.author ?? null,
      tags: frontmatter.tags ?? [],
      always: this.readAlwaysFlag(metadata),
    };
  };

  private matchesInstalledSkillQuery = (
    skill: InstalledSkillSummary,
    query: string | null,
  ): boolean => {
    if (!query) {
      return true;
    }

    const haystacks = [
      skill.ref,
      skill.name,
      skill.path,
      skill.relativePath ?? "",
      skill.scope,
      skill.source,
      skill.summary ?? "",
      skill.description ?? "",
      skill.author ?? "",
      ...skill.tags,
      ...Object.values(skill.summaryI18n ?? {}),
      ...Object.values(skill.descriptionI18n ?? {}),
    ];

    return haystacks.some((value) => value.toLowerCase().includes(query));
  };

  private readAlwaysFlag = (metadata: Record<string, string> | null): boolean => {
    if (metadata?.always === "true") {
      return true;
    }

    const raw = metadata?.metadata;
    if (!raw) {
      return false;
    }

    try {
      const parsed = JSON.parse(raw) as {
        nextclaw?: {
          always?: unknown;
        };
      };
      return parsed.nextclaw?.always === true;
    } catch {
      return false;
    }
  };

  private buildRelativePath = (absolutePath: string): string | null => {
    const relativePath = relative(this.workspace, absolutePath).replace(/\\/g, "/");
    return relativePath.startsWith("..") ? null : relativePath;
  };

  private normalizeInstalledScope = (value: string | undefined): InstalledSkillScopeFilter => {
    const normalized = this.normalizeOptionalString(value);
    if (!normalized || normalized === "all") {
      return "all";
    }
    if (normalized === "builtin" || normalized === "project" || normalized === "workspace") {
      return normalized;
    }
    throw new Error(`Invalid skill scope: ${value}. Expected all, builtin, project, or workspace.`);
  };

  private normalizeOptionalString = (value: string | undefined): string | null => {
    if (typeof value !== "string") {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };
}
