import type { ContextProviderRunContextService } from "@kernel/contributions/context-provider/services/context-provider-run-context.service.js";
import type {
  AgentRunRequest,
  ContextBlock,
  ContextProvider,
} from "@kernel/types/agent-run.types.js";
import { SkillsLoader } from "@nextclaw/core";

function wrapSkillTag(tagName: string, manifest: string): string {
  return [`<${tagName}>`, manifest, `</${tagName}>`].join("\n");
}

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
    "These always-on skills are already active for this session context.",
    "If an active skill covers the user's intent, follow it before considering unrelated available skills.",
    "For NextClaw self-management intents, read the built-in NextClaw self-management guide before loading any unrelated generic skill.",
    "Skill refs are unique identities; names may repeat.",
    "Read a SKILL.md from <location> only when you need its instructions.",
    "",
    wrapSkillTag("active_skills", manifest),
  ].join("\n\n");
}

function renderAvailableSkillsSection(skills: SkillsLoader): string {
  const summary = skills.buildSkillsSummary();
  if (!summary) {
    return "";
  }
  return [
    "## Skills (mandatory)",
    "Always-on skills in <active_skills> take precedence over this list.",
    "Before replying: first check whether any entry in <available_skills> may be relevant to the user's intent, task type, or requested output. Do not skip this check just because the task seems familiar.",
    "- If one skill looks like the best relevant match, read its SKILL.md at <location> with `read_file`, then decide whether following it is actually helpful.",
    "- If a SKILL.md read says `Use offset=... to continue`, continue reading until the relevant trigger, required workflow, constraints, and output requirements are covered.",
    "- If the user is asking to manage NextClaw itself, read the built-in NextClaw self-management guide first and do not open unrelated generic skills before that.",
    "- If multiple skills share the same <name>, use <ref> to distinguish them. Never assume duplicate names mean the same skill.",
    "- If none clearly apply: do not read any SKILL.md.",
    "Constraints: never read more than one skill up front; only read after selecting.",
    "",
    "<available_skills>",
    summary,
    "</available_skills>",
  ].join("\n");
}

function renderSkillLearningSection(): string {
  return [
    "# Skill Learning Loop",
    "After non-trivial work, run a brief review before your final answer.",
    "- Summarize the reusable lesson, not the full transcript.",
    "- Decide exactly one outcome: `no_skill_change`, `patch_existing_skill`, or `create_new_skill`.",
    "- Prefer patching an existing skill when the lesson extends or corrects it; only create a new skill when the trigger and workflow are genuinely distinct.",
    "- Promote a lesson into a skill only when it has a clear trigger, repeatable steps, and failure signals/checks.",
    "- Do not create skills for one-off facts, narrow local quirks, or work that is not likely to recur.",
    "- Keep the review concise and action-oriented. Do not add user-visible review text unless it materially helps or the user asks for it.",
  ].join("\n");
}

export class SkillsContextProvider implements ContextProvider {
  constructor(private readonly context: ContextProviderRunContextService) {}

  provide = async (
    request: AgentRunRequest,
  ): Promise<readonly ContextBlock[]> => {
    const { projectContext } = await this.context.resolve(request);
    const skills = new SkillsLoader({
      workspace: projectContext.hostWorkspace,
      projectRoot: projectContext.projectRoot,
    });
    const blocks: ContextBlock[] = [];
    const alwaysSkills = skills.getAlwaysSkills();
    if (alwaysSkills.length) {
      const activeSection = renderActiveSkillsSection(skills, alwaysSkills);
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
