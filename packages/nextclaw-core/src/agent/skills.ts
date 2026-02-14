import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { SKILL_METADATA_KEY } from "../config/brand.js";

const BUILTIN_SKILLS_DIR = join(fileURLToPath(new URL(".", import.meta.url)), "skills");

export type SkillInfo = {
  name: string;
  path: string;
  source: "workspace" | "builtin";
};

export class SkillsLoader {
  private workspaceSkills: string;
  private builtinSkills: string;

  constructor(private workspace: string, builtinSkillsDir?: string) {
    this.workspaceSkills = join(workspace, "skills");
    this.builtinSkills = builtinSkillsDir ?? BUILTIN_SKILLS_DIR;
  }

  listSkills(filterUnavailable = true): SkillInfo[] {
    const skills: SkillInfo[] = [];

    if (existsSync(this.workspaceSkills)) {
      for (const entry of readdirSync(this.workspaceSkills, { withFileTypes: true })) {
        if (!entry.isDirectory()) {
          continue;
        }
        const skillFile = join(this.workspaceSkills, entry.name, "SKILL.md");
        if (existsSync(skillFile)) {
          skills.push({ name: entry.name, path: skillFile, source: "workspace" });
        }
      }
    }

    if (existsSync(this.builtinSkills)) {
      for (const entry of readdirSync(this.builtinSkills, { withFileTypes: true })) {
        if (!entry.isDirectory()) {
          continue;
        }
        const skillFile = join(this.builtinSkills, entry.name, "SKILL.md");
        if (existsSync(skillFile) && !skills.some((s) => s.name === entry.name)) {
          skills.push({ name: entry.name, path: skillFile, source: "builtin" });
        }
      }
    }

    if (filterUnavailable) {
      return skills.filter((skill) => this.checkRequirements(this.getSkillMeta(skill.name)));
    }

    return skills;
  }

  loadSkill(name: string): string | null {
    const workspaceSkill = join(this.workspaceSkills, name, "SKILL.md");
    if (existsSync(workspaceSkill)) {
      return readFileSync(workspaceSkill, "utf-8");
    }
    const builtinSkill = join(this.builtinSkills, name, "SKILL.md");
    if (existsSync(builtinSkill)) {
      return readFileSync(builtinSkill, "utf-8");
    }
    return null;
  }

  loadSkillsForContext(skillNames: string[]): string {
    const parts: string[] = [];
    for (const name of skillNames) {
      const content = this.loadSkill(name);
      if (content) {
        parts.push(`### Skill: ${name}\n\n${this.stripFrontmatter(content)}`);
      }
    }
    return parts.length ? parts.join("\n\n---\n\n") : "";
  }

  buildSkillsSummary(): string {
    const allSkills = this.listSkills(false);
    if (!allSkills.length) {
      return "";
    }

    const escapeXml = (value: string) =>
      value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const lines: string[] = ["<skills>"];
    for (const skill of allSkills) {
      const desc = escapeXml(this.getSkillDescription(skill.name));
      const meta = this.getSkillMeta(skill.name);
      const available = this.checkRequirements(meta);
      lines.push(`  <skill available="${available}">`);
      lines.push(`    <name>${escapeXml(skill.name)}</name>`);
      lines.push(`    <description>${desc}</description>`);
      lines.push(`    <location>${skill.path}</location>`);
      if (!available) {
        const missing = this.getMissingRequirements(meta);
        if (missing) {
          lines.push(`    <requires>${escapeXml(missing)}</requires>`);
        }
      }
      lines.push("  </skill>");
    }
    lines.push("</skills>");
    return lines.join("\n");
  }

  getAlwaysSkills(): string[] {
    const result: string[] = [];
    for (const skill of this.listSkills(true)) {
      const meta = this.getSkillMetadata(skill.name) ?? {};
      const parsed = this.parseSkillMetadata(meta.metadata ?? "");
      if (parsed.always || (meta as { always?: string }).always === "true") {
        result.push(skill.name);
      }
    }
    return result;
  }

  getSkillMetadata(name: string): Record<string, string> | null {
    const content = this.loadSkill(name);
    if (!content || !content.startsWith("---")) {
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
  }

  private getSkillDescription(name: string): string {
    const meta = this.getSkillMetadata(name);
    if (meta?.description) {
      return meta.description;
    }
    return name;
  }

  private stripFrontmatter(content: string): string {
    if (content.startsWith("---")) {
      const match = content.match(/^---\n.*?\n---\n/s);
      if (match) {
        return content.slice(match[0].length).trim();
      }
    }
    return content;
  }

  private parseSkillMetadata(raw: string): Record<string, unknown> {
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
  }

  private getSkillMeta(name: string): Record<string, unknown> {
    const meta = this.getSkillMetadata(name) ?? {};
    return this.parseSkillMetadata(meta.metadata ?? "");
  }

  private checkRequirements(skillMeta: Record<string, unknown>): boolean {
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
  }

  private getMissingRequirements(skillMeta: Record<string, unknown>): string {
    const missing: string[] = [];
    const requires = (skillMeta.requires ?? {}) as { bins?: string[]; env?: string[] };
    if (requires.bins) {
      for (const bin of requires.bins) {
        if (!this.which(bin)) {
          missing.push(`CLI: ${bin}`);
        }
      }
    }
    if (requires.env) {
      for (const env of requires.env) {
        if (!process.env[env]) {
          missing.push(`ENV: ${env}`);
        }
      }
    }
    return missing.join(", ");
  }

  private which(binary: string): boolean {
    const paths = (process.env.PATH ?? "").split(":");
    for (const dir of paths) {
      const full = join(dir, binary);
      if (existsSync(full)) {
        return true;
      }
    }
    return false;
  }
}
