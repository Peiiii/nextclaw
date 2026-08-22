import type { ContextProviderRunContextService } from "@kernel/contributions/context-provider/services/context-provider-run-context.service.js";
import type {
  AgentRunRequest,
  ContextBlock,
  ContextProvider,
} from "@kernel/types/agent-run.types.js";
import { SkillsLoader } from "@nextclaw/core";

function renderActiveSkillsSection(
  skills: SkillsLoader,
  skillSelectors: string[],
): string {
  const manifest = skills.buildSkillsManifest(skillSelectors);
  if (!manifest) {
    return "";
  }
  return [
    "# Active Skills",
    "These user-selected or always-on skills take precedence when relevant. Read the chosen `Root/<name>/SKILL.md` before following it.",
    "For NextClaw self-management, use the active built-in self-management skill before unrelated generic skills.",
    manifest,
  ].join("\n");
}

function renderSkillSourcesSection(params: {
  hostWorkspace: string;
  projectSkillsRoot: string | null;
}): string {
  const projectRule = params.projectSkillsRoot
    ? `- Project-only skills belong in \`${params.projectSkillsRoot}/<skill-name>/SKILL.md\`.`
    : "- No session-bound project is active; do not invent a project skill location.";
  return [
    "## Skill Sources",
    projectRule,
    `- Workspace skills: \`${params.hostWorkspace}/skills\`; global skills: \`~/.agents/skills\`; built-ins ship with NextClaw.`,
    "- Each catalog group gives its exact root; read a skill at `Root/<name>/SKILL.md`. Project `AGENTS.md` is separate bootstrap context.",
  ].join("\n");
}

function renderAvailableSkillsSection(skills: SkillsLoader): string {
  const summary = skills.buildSkillsSummary();
  if (!summary) {
    return "";
  }
  return [
    "## Skills",
    "All listed skills remain available. Before replying, check their full descriptions; active skills above take precedence.",
    "If one skill is the best match, read its `Root/<name>/SKILL.md` with `read_file` before deciding whether to follow it. Continue offset reads when instructed. Read at most one skill up front; if none fits, read none.",
    "Names may repeat across source groups, so use the group and root to identify the intended skill. For NextClaw self-management, prefer the built-in self-management skill.",
    summary,
  ].join("\n");
}

function renderSkillLearningSection(): string {
  return [
    "# Skill Learning Loop",
    "After non-trivial work, briefly choose `no_skill_change`, `patch_existing_skill`, or `create_new_skill`.",
    "Patch when extending an existing workflow; create only for a distinct, reusable trigger with repeatable steps and checks. Never promote one-off facts or narrow quirks. Keep the review internal unless it materially helps or the user asks.",
  ].join("\n");
}

export class SkillsContextProvider implements ContextProvider {
  constructor(private readonly context: ContextProviderRunContextService) {}

  provide = async (
    request: AgentRunRequest,
  ): Promise<readonly ContextBlock[]> => {
    const { projectContext, runContext } = await this.context.resolve(request);
    const skills = new SkillsLoader({
      workspace: projectContext.hostWorkspace,
      projectRoot: projectContext.projectRoot,
      includeGlobal: true,
    });
    const blocks: ContextBlock[] = [
      renderSkillSourcesSection({
        hostWorkspace: projectContext.hostWorkspace,
        projectSkillsRoot: projectContext.projectSkillsRoot,
      }),
    ];
    const activeSkills = [
      ...runContext.requestedSkills.selectors,
      ...skills.getAlwaysSkills(),
    ];
    if (activeSkills.length) {
      const activeSection = renderActiveSkillsSection(skills, activeSkills);
      if (activeSection) {
        blocks.push(activeSection);
      }
    }

    const availableSkillsSection = renderAvailableSkillsSection(skills);
    if (availableSkillsSection) {
      blocks.push(availableSkillsSection);
    }

    blocks.push(renderSkillLearningSection());
    return blocks;
  };
}
