import { dirname } from "node:path";
import {
  SkillsLoader,
  type SkillInfo as CoreSkillInfo,
} from "@nextclaw/core";

export type { SkillInfo, SkillScope } from "@nextclaw/core";

type WorkspaceParams = { workspace: string };

export class SkillManager {
  private readonly loader: SkillsLoader;

  constructor(params: WorkspaceParams) {
    this.loader = new SkillsLoader(params.workspace);
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

  findBuiltinSkill = (name: string): CoreSkillInfo | null => {
    return this
      .listSkills({ filterUnavailable: false })
      .find((skill) => skill.name === name && skill.source === "builtin") ?? null;
  };

  resolveBuiltinSkillDir = (name: string): string | null => {
    const skill = this.findBuiltinSkill(name);
    return skill ? dirname(skill.path) : null;
  };
}
