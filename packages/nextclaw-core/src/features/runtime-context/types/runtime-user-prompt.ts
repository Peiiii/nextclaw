import type { Config } from "../config/schema.js";
import {
  buildRequestedSkillsUserPrompt,
  buildSkillLearningUserPromptSection,
} from "../agent/skill-context.js";
import { SkillsLoader } from "../agent/skills-loader.js";
import { buildMinimalRuntimeExecutionPrompt } from "../agent/execution-prompt.utils.js";
import {
  SessionProjectContextResolver,
  type SessionProjectContext,
} from "../session/session-project-context.js";
import { buildWorkspaceProjectContextSection } from "./bootstrap-context.service.js";

type ContextConfig = Config["agents"]["context"];

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
      readStringList(metadata.requested_skill_refs ?? metadata.requestedSkillRefs),
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

export type RuntimeUserPromptSessionContext = {
  projectContext: SessionProjectContext;
  skills: SkillsLoader;
  requestedSkills: RequestedSkillsSelection;
  prompt: string;
};

export class RuntimeUserPromptBuilder {
  private readonly projectContextResolver = new SessionProjectContextResolver();
  private readonly requestedSkillsReader = new RequestedSkillsMetadataReader();

  buildSessionPromptContext = (params: {
    workspace: string;
    hostWorkspace?: string;
    contextConfig?: ContextConfig;
    sessionKey?: string;
    metadata?: Record<string, unknown>;
    userMessage: string;
    model?: string | null;
  }): RuntimeUserPromptSessionContext => {
    const {
      workspace,
      hostWorkspace,
      contextConfig,
      sessionKey,
      metadata,
      userMessage,
      model,
    } = params;
    const projectContext = this.projectContextResolver.resolve({
      sessionMetadata: metadata,
      workspace: hostWorkspace ?? workspace,
      defaultWorkspace: workspace,
    });
    const skills = new SkillsLoader({
      workspace: projectContext.hostWorkspace,
      projectRoot: projectContext.projectRoot,
    });
    const requestedSkills = this.requestedSkillsReader.readSelection(
      metadata,
    );

    return {
      projectContext,
      skills,
      requestedSkills,
      prompt: this.buildBootstrapAwareUserPrompt({
        workspace: projectContext.effectiveWorkspace,
        hostWorkspace: projectContext.hostWorkspace,
        contextConfig,
        sessionKey,
        metadata,
        skills,
        skillSelectors: requestedSkills.selectors,
        userMessage,
        model,
      }),
    };
  };

  buildBootstrapAwareUserPrompt = (params: {
    workspace: string;
    hostWorkspace?: string;
    contextConfig?: ContextConfig;
    sessionKey?: string;
    metadata?: Record<string, unknown>;
    skills: SkillsLoader;
    skillSelectors: string[];
    userMessage: string;
    model?: string | null;
  }): string => {
    const {
      workspace,
      hostWorkspace,
      contextConfig,
      sessionKey,
      metadata,
      skills,
      skillSelectors,
      userMessage,
      model,
    } = params;
    const projectContext = this.projectContextResolver.resolve({
      sessionMetadata: metadata,
      workspace: hostWorkspace ?? workspace,
      defaultWorkspace: workspace,
    });
    const requestedSkillsPrompt = buildRequestedSkillsUserPrompt(
      skills,
      skillSelectors,
      userMessage,
    );
    const executionPrompt = buildMinimalRuntimeExecutionPrompt(model);
    const skillLearningPrompt = buildSkillLearningUserPromptSection();
    const contextSection = buildWorkspaceProjectContextSection({
      projectContext,
      contextConfig,
      sessionKey,
    });

    return [contextSection, executionPrompt, skillLearningPrompt, requestedSkillsPrompt]
      .filter(Boolean)
      .join("\n\n");
  };
}

export const DEFAULT_RUNTIME_USER_PROMPT_BUILDER = new RuntimeUserPromptBuilder();

export function buildBootstrapAwareUserPrompt(params: {
  workspace: string;
  hostWorkspace?: string;
  contextConfig?: ContextConfig;
  sessionKey?: string;
  metadata?: Record<string, unknown>;
  skills: SkillsLoader;
  skillSelectors: string[];
  userMessage: string;
  model?: string | null;
}): string {
  return DEFAULT_RUNTIME_USER_PROMPT_BUILDER.buildBootstrapAwareUserPrompt(params);
}
