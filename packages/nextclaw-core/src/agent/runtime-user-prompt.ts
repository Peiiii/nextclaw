import type { Config } from "../config/schema.js";
import { buildRequestedSkillsUserPrompt } from "./skill-context.js";
import type { SkillsLoader } from "./skills.js";
import { buildWorkspaceProjectContextSection } from "./bootstrap-context.js";

type ContextConfig = Config["agents"]["context"];

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function readRequestedSkillsFromMetadata(
  metadata: Record<string, unknown> | undefined,
): string[] {
  if (!metadata) {
    return [];
  }

  const raw = metadata.requested_skills ?? metadata.requestedSkills;
  const values: string[] = [];
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const skillName = readString(entry);
      if (skillName) {
        values.push(skillName);
      }
    }
  } else if (typeof raw === "string") {
    values.push(
      ...raw
        .split(/[,\s]+/g)
        .map((entry) => entry.trim())
        .filter(Boolean),
    );
  }

  return Array.from(new Set(values)).slice(0, 8);
}

export function buildBootstrapAwareUserPrompt(params: {
  workspace: string;
  contextConfig?: ContextConfig;
  sessionKey?: string;
  skills: SkillsLoader;
  skillNames: string[];
  userMessage: string;
}): string {
  const prompt = buildRequestedSkillsUserPrompt(
    params.skills,
    params.skillNames,
    params.userMessage,
  );
  const projectContext = buildWorkspaceProjectContextSection({
    workspace: params.workspace,
    contextConfig: params.contextConfig,
    sessionKey: params.sessionKey,
  });
  if (!projectContext) {
    return prompt;
  }
  return [projectContext, prompt].join("\n\n");
}
