import type { SkillsLoader } from "./skills.js";

function wrapSkillTag(tagName: string, manifest: string): string {
  return [`<${tagName}>`, manifest, `</${tagName}>`].join("\n");
}

function buildSelectedSkillsBlock(skills: SkillsLoader, skillNames: string[]): string {
  const manifest = skills.buildSkillsManifest(skillNames);
  if (!manifest) {
    return "";
  }
  return [
    "## Requested Skills",
    "The user explicitly selected the following skills for this turn.",
    "In user-visible chat text, tokens like `$weather` or `$web-search` are explicit skill-selection markers authored by the user.",
    "Only skill names and paths are included here.",
    "If you need a skill's instructions, read the corresponding SKILL.md from <location>.",
    "You MUST prioritize these selected skills in this turn unless higher-priority safety/system instructions conflict.",
    "",
    wrapSkillTag("requested_skills", manifest),
  ].join("\n\n");
}

export function buildRequestedSkillsSystemSection(skills: SkillsLoader, skillNames: string[]): string {
  const block = buildSelectedSkillsBlock(skills, skillNames);
  if (!block) {
    return "";
  }
  return block.replace("## Requested Skills", "# Requested Skills");
}

export function buildRequestedSkillsUserPrompt(
  skills: SkillsLoader,
  skillNames: string[],
  userMessage: string,
): string {
  const block = buildSelectedSkillsBlock(skills, skillNames);
  if (!block) {
    return userMessage;
  }
  return [block, "## User Message", userMessage].join("\n\n");
}

export function buildActiveSkillsSystemSection(skills: SkillsLoader, skillNames: string[]): string {
  const manifest = skills.buildSkillsManifest(skillNames);
  if (!manifest) {
    return "";
  }
  return [
    "# Active Skills",
    "These always-on skills are available for this workspace.",
    "Only skill names and paths are included here.",
    "Read a SKILL.md from <location> only when you need its instructions.",
    "",
    wrapSkillTag("active_skills", manifest),
  ].join("\n\n");
}

export function buildAvailableSkillsSystemSection(skills: SkillsLoader): string {
  const summary = skills.buildSkillsSummary();
  if (!summary) {
    return "";
  }
  return [
    "## Skills (mandatory)",
    "Before replying: scan <available_skills> entries.",
    "- If exactly one skill clearly applies: read its SKILL.md at <location> with `read_file`, then follow it.",
    "- If multiple could apply: choose the most specific one by skill name, then read/follow it.",
    "- If none clearly apply: do not read any SKILL.md.",
    "Constraints: never read more than one skill up front; only read after selecting.",
    "",
    "<available_skills>",
    summary,
    "</available_skills>",
  ].join("\n");
}
