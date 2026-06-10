import { SkillsLoader } from "@core/features/agent/index.js";

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
