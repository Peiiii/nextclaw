import * as NextclawCore from "@nextclaw/core";

type SkillInfo = {
  name: string;
  path: string;
  source: "workspace" | "builtin";
};

type SkillsLoaderInstance = {
  listSkills: (filterUnavailable?: boolean) => SkillInfo[];
};

type SkillsLoaderConstructor = new (
  workspace: string,
  builtinSkillsDir?: string,
) => SkillsLoaderInstance;

export function createSkillsLoader(workspace: string): SkillsLoaderInstance | null {
  const ctor = (NextclawCore as { SkillsLoader?: SkillsLoaderConstructor }).SkillsLoader;
  if (!ctor) {
    return null;
  }
  return new ctor(workspace);
}
