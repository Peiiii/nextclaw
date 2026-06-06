import type { SkillsLoader } from "@core/features/agent/services/skills-loader.js";

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function readStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => readString(entry))
      .filter((entry): entry is string => Boolean(entry));
  }
  if (typeof value === "string") {
    return value
      .split(/[,\s]+/g)
      .map((entry) => readString(entry))
      .filter((entry): entry is string => Boolean(entry));
  }
  return [];
}

function dedupeRequestedSkills(values: string[]): string[] {
  return Array.from(new Set(values)).slice(0, 8);
}

function wrapSkillTag(tagName: string, manifest: string): string {
  return [`<${tagName}>`, manifest, `</${tagName}>`].join("\n");
}

export type RequestedSkillsSelection = {
  refs: string[];
  names: string[];
  selectors: string[];
  eventMetadata: Record<string, unknown>;
};

export class RequestedSkillsMetadataReader {
  readRefs = (metadata: Record<string, unknown> | undefined): string[] => {
    if (!metadata) {
      return [];
    }
    return dedupeRequestedSkills(
      readStringList(
        metadata.requested_skill_refs ?? metadata.requestedSkillRefs,
      ),
    );
  };

  readNames = (metadata: Record<string, unknown> | undefined): string[] => {
    if (!metadata) {
      return [];
    }
    return dedupeRequestedSkills(
      readStringList(metadata.requested_skills ?? metadata.requestedSkills),
    );
  };

  readSelectors = (metadata: Record<string, unknown> | undefined): string[] => {
    const refs = this.readRefs(metadata);
    if (refs.length > 0) {
      return refs;
    }
    return this.readNames(metadata);
  };

  readSelection = (
    metadata: Record<string, unknown> | undefined,
  ): RequestedSkillsSelection => {
    const refs = this.readRefs(metadata);
    const names = refs.length > 0 ? [] : this.readNames(metadata);
    return {
      refs,
      names,
      selectors: refs.length > 0 ? refs : names,
      eventMetadata:
        refs.length > 0
          ? { requested_skill_refs: refs }
          : names.length > 0
            ? { requested_skills: names }
            : {},
    };
  };
}

const SKILL_LEARNING_SYSTEM_LINES = [
  "# Skill Learning Loop",
  "After non-trivial work, run a brief review before your final answer.",
  "- Summarize the reusable lesson, not the full transcript.",
  "- Decide exactly one outcome: `no_skill_change`, `patch_existing_skill`, or `create_new_skill`.",
  "- Prefer patching an existing skill when the lesson extends or corrects it; only create a new skill when the trigger and workflow are genuinely distinct.",
  "- Promote a lesson into a skill only when it has a clear trigger, repeatable steps, and failure signals/checks.",
  "- Do not create skills for one-off facts, narrow local quirks, or work that is not likely to recur.",
  "- Keep the review concise and action-oriented. Do not add user-visible review text unless it materially helps or the user asks for it.",
];

function buildSelectedSkillsBlock(
  skills: SkillsLoader,
  skillSelectors: string[],
): string {
  const manifest = skills.buildSkillsManifest(skillSelectors);
  if (!manifest) {
    return "";
  }
  return [
    "## Requested Skills",
    "The user explicitly selected the following skills for this turn.",
    "In user-visible chat text, tokens like `$weather` or `$web-search` are explicit skill-selection markers authored by the user.",
    "Skill refs are the authoritative identity. Skill names may repeat across project and workspace scopes.",
    "If you need a skill's instructions, read the corresponding SKILL.md from <location>.",
    "You MUST prioritize these selected skills in this turn unless higher-priority safety/system instructions conflict.",
    "",
    wrapSkillTag("requested_skills", manifest),
  ].join("\n\n");
}

export function buildRequestedSkillsSystemSection(
  skills: SkillsLoader,
  skillSelectors: string[],
): string {
  const block = buildSelectedSkillsBlock(skills, skillSelectors);
  if (!block) {
    return "";
  }
  return block.replace("## Requested Skills", "# Requested Skills");
}

export function buildRequestedSkillsUserPrompt(
  skills: SkillsLoader,
  skillSelectors: string[],
  userMessage: string,
): string {
  const block = buildSelectedSkillsBlock(skills, skillSelectors);
  if (!block) {
    return userMessage;
  }
  return [block, "## User Message", userMessage].join("\n\n");
}

export function buildActiveSkillsSystemSection(
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

export function buildAvailableSkillsSystemSection(
  skills: SkillsLoader,
): string {
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

export function buildSkillLearningSystemSection(): string {
  return SKILL_LEARNING_SYSTEM_LINES.join("\n");
}
