import { SkillsLoader } from "../../agent/services/skills-loader.js";

export class LayeredSkillsLoader extends SkillsLoader {
  constructor(
    workspace: string,
    supportingWorkspaces: string[] = [],
  ) {
    super({
      workspace,
      supportingWorkspaces,
    });
  }
}
