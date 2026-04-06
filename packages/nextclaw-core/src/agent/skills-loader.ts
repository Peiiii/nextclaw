import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SKILL_METADATA_KEY } from "../config/brand.js";
import { DEFAULT_PROJECT_SKILLS_DIR_NAME } from "../session/session-project-context.js";

export type SkillScope = "builtin" | "project" | "workspace";

export type SkillInfo = {
  ref: string;
  name: string;
  path: string;
  source: SkillScope;
  scope: SkillScope;
};

export type SkillsLoaderOptions = {
  workspace: string;
  projectRoot?: string | null;
  supportingWorkspaces?: string[];
  projectSkillsDirName?: string;
  includeBuiltin?: boolean;
};

type SkillDirectoryDescriptor = {
  scope: SkillScope;
  skillsRoot: string;
};

type ResolvedSkillMatch = {
  skill: SkillInfo;
  resolution: "ref" | "name";
};

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function dedupeStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const normalized = normalizeOptionalString(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    output.push(normalized);
  }

  return output;
}

export class SkillSelectionAmbiguityError extends Error {
  readonly selector: string;
  readonly matches: SkillInfo[];

  constructor(selector: string, matches: SkillInfo[]) {
    super(
      [
        `Requested skill "${selector}" is ambiguous.`,
        "Multiple skills share this name. Retry with requested_skill_refs using one of:",
        ...matches.map((skill) => `- ${skill.ref}`),
      ].join("\n"),
    );
    this.name = "SkillSelectionAmbiguityError";
    this.selector = selector;
    this.matches = matches;
  }
}

export class SkillsLoader {
  private readonly workspace: string;
  private readonly projectRoot: string | null;
  private readonly supportingWorkspaces: string[];
  private readonly projectSkillsDirName: string;
  private readonly includeBuiltin: boolean;

  constructor(workspace: string);
  constructor(options: SkillsLoaderOptions);
  constructor(
    workspaceOrOptions: string | SkillsLoaderOptions,
  ) {
    if (typeof workspaceOrOptions === "string") {
      this.workspace = workspaceOrOptions;
      this.projectRoot = null;
      this.supportingWorkspaces = [];
      this.projectSkillsDirName = DEFAULT_PROJECT_SKILLS_DIR_NAME;
      this.includeBuiltin = true;
      return;
    }

    this.workspace = workspaceOrOptions.workspace;
    this.projectRoot = normalizeOptionalString(workspaceOrOptions.projectRoot);
    this.supportingWorkspaces = dedupeStrings(workspaceOrOptions.supportingWorkspaces ?? []);
    this.projectSkillsDirName =
      normalizeOptionalString(workspaceOrOptions.projectSkillsDirName) ??
      DEFAULT_PROJECT_SKILLS_DIR_NAME;
    this.includeBuiltin = workspaceOrOptions.includeBuiltin ?? true;
  }

  listSkills = (filterUnavailable = true): SkillInfo[] => {
    const skills = this.collectSkills();
    if (!filterUnavailable) {
      return skills;
    }
    return skills.filter((skill) => this.checkRequirements(this.getSkillMeta(skill)));
  };

  loadSkill = (selector: string): string | null => {
    const skill = this.getSkillInfo(selector);
    if (!skill) {
      return null;
    }
    return readFileSync(skill.path, "utf-8");
  };

  getSkillInfo = (selector: string): SkillInfo | null => {
    return this.resolveSkill(selector, false)?.skill ?? null;
  };

  getSkillMetadata = (
    selector: string | SkillInfo,
  ): Record<string, string> | null => {
    const skill =
      typeof selector === "string" ? this.getSkillInfo(selector) : selector;
    if (!skill) {
      return null;
    }

    const content = readFileSync(skill.path, "utf-8");
    if (!content.startsWith("---")) {
      return null;
    }

    const match = content.match(/^---\n(.*?)\n---/s);
    if (!match) {
      return null;
    }

    const metadata: Record<string, string> = {};
    for (const line of match[1].split("\n")) {
      const [key, ...rest] = line.split(":");
      if (!key || rest.length === 0) {
        continue;
      }
      metadata[key.trim()] = rest.join(":").trim().replace(/^['"]|['"]$/g, "");
    }
    return metadata;
  };

  buildSkillsManifest = (selectors: string[]): string => {
    const parts: string[] = [];
    const seenRefs = new Set<string>();

    for (const selector of selectors) {
      const match = this.resolveSkill(selector, true);
      if (!match || seenRefs.has(match.skill.ref)) {
        continue;
      }
      seenRefs.add(match.skill.ref);
      parts.push(...this.buildSkillXmlLines(match.skill, "  "));
    }

    return parts.length > 0 ? parts.join("\n") : "";
  };

  buildSkillsSummary = (): string => {
    const allSkills = this.listSkills(true);
    if (allSkills.length === 0) {
      return "";
    }

    const lines: string[] = ["<skills>"];
    for (const skill of allSkills) {
      lines.push(...this.buildSkillXmlLines(skill, "  "));
    }
    lines.push("</skills>");
    return lines.join("\n");
  };

  getAlwaysSkills = (): string[] => {
    const result: string[] = [];
    for (const skill of this.listSkills(true)) {
      const metadata = this.getSkillMetadata(skill) ?? {};
      const parsed = this.parseSkillMetadata(metadata.metadata ?? "");
      if (parsed.always || (metadata as { always?: string }).always === "true") {
        result.push(skill.ref);
      }
    }
    return result;
  };

  private collectSkills = (): SkillInfo[] => {
    const builtinSkills = this.includeBuiltin ? this.collectBuiltinSkills() : [];
    const builtinNames = new Set(builtinSkills.map((skill) => skill.name));

    return [
      ...builtinSkills,
      ...this.collectProjectSkills().filter((skill) => !builtinNames.has(skill.name)),
      ...this.collectWorkspaceSkills().filter((skill) => !builtinNames.has(skill.name)),
    ];
  };

  private collectBuiltinSkills = (): SkillInfo[] => {
    const skillsRoot = this.resolveBuiltinSkillsRoot();
    if (!skillsRoot) {
      return [];
    }
    return this.collectDirectorySkills({
      scope: "builtin",
      skillsRoot,
    });
  };

  private collectProjectSkills = (): SkillInfo[] => {
    if (!this.projectRoot) {
      return [];
    }
    return this.collectDirectorySkills({
      scope: "project",
      skillsRoot: join(this.projectRoot, this.projectSkillsDirName),
    });
  };

  private collectWorkspaceSkills = (): SkillInfo[] => {
    const descriptors: SkillDirectoryDescriptor[] = dedupeStrings([
      this.workspace,
      ...this.supportingWorkspaces,
    ]).map((workspace) => ({
      scope: "workspace",
      skillsRoot: join(workspace, "skills"),
    }));

    return descriptors.flatMap((descriptor) => this.collectDirectorySkills(descriptor));
  };

  private collectDirectorySkills = (
    descriptor: SkillDirectoryDescriptor,
  ): SkillInfo[] => {
    if (!existsSync(descriptor.skillsRoot)) {
      return [];
    }

    const output: SkillInfo[] = [];
    for (const entry of readdirSync(descriptor.skillsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      const skillDir = join(descriptor.skillsRoot, entry.name);
      const skillFile = join(skillDir, "SKILL.md");
      if (!existsSync(skillFile)) {
        continue;
      }
      output.push({
        ref: `${descriptor.scope}:${skillDir}`,
        name: entry.name,
        path: skillFile,
        scope: descriptor.scope,
        source: descriptor.scope,
      });
    }
    return output;
  };

  private resolveBuiltinSkillsRoot = (): string | null => {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const candidates = [
      join(currentDir, "skills"),
      resolve(currentDir, "..", "skills"),
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }
    return null;
  };

  private resolveSkill = (
    selector: string,
    rejectAmbiguousNames: boolean,
  ): ResolvedSkillMatch | null => {
    const normalizedSelector = normalizeOptionalString(selector);
    if (!normalizedSelector) {
      return null;
    }

    const skills = this.collectSkills();
    const byRef = skills.find((skill) => skill.ref === normalizedSelector);
    if (byRef) {
      return { skill: byRef, resolution: "ref" };
    }

    const matches = skills.filter((skill) => skill.name === normalizedSelector);
    if (matches.length === 0) {
      return null;
    }
    if (matches.length > 1 && rejectAmbiguousNames) {
      throw new SkillSelectionAmbiguityError(normalizedSelector, matches);
    }
    return { skill: matches[0], resolution: "name" };
  };

  private buildSkillXmlLines = (skill: SkillInfo, indent: string): string[] => {
    const description = this.getSkillMetadata(skill)?.description?.trim();
    const lines = [
      `${indent}<skill>`,
      `${indent}  <name>${this.escapeXml(skill.name)}</name>`,
      `${indent}  <ref>${this.escapeXml(skill.ref)}</ref>`,
      `${indent}  <scope>${this.escapeXml(skill.scope)}</scope>`,
      `${indent}  <source>${this.escapeXml(skill.source)}</source>`,
    ];
    if (description) {
      lines.push(`${indent}  <description>${this.escapeXml(description)}</description>`);
    }
    lines.push(`${indent}  <location>${this.escapeXml(skill.path)}</location>`);
    lines.push(`${indent}</skill>`);
    return lines;
  };

  private escapeXml = (value: string): string => {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  };

  private parseSkillMetadata = (raw: string): Record<string, unknown> => {
    try {
      const data = JSON.parse(raw);
      if (typeof data !== "object" || !data) {
        return {};
      }
      const meta = (data as Record<string, unknown>)[SKILL_METADATA_KEY];
      if (typeof meta === "object" && meta) {
        return meta as Record<string, unknown>;
      }
      return {};
    } catch {
      return {};
    }
  };

  private getSkillMeta = (selector: string | SkillInfo): Record<string, unknown> => {
    const metadata = this.getSkillMetadata(selector) ?? {};
    return this.parseSkillMetadata(metadata.metadata ?? "");
  };

  private checkRequirements = (skillMeta: Record<string, unknown>): boolean => {
    const requires = (skillMeta.requires ?? {}) as { bins?: string[]; env?: string[] };
    if (requires.bins) {
      for (const bin of requires.bins) {
        if (!this.which(bin)) {
          return false;
        }
      }
    }
    if (requires.env) {
      for (const env of requires.env) {
        if (!process.env[env]) {
          return false;
        }
      }
    }
    return true;
  };

  private which = (binary: string): boolean => {
    for (const dir of (process.env.PATH ?? "").split(":")) {
      const full = join(dir, binary);
      if (existsSync(full)) {
        return true;
      }
    }
    return false;
  };
}
