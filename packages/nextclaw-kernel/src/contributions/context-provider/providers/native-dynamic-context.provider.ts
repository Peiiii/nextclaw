import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ContextProviderRunContextService } from "@kernel/contributions/context-provider/services/context-provider-run-context.service.js";
import type {
  AgentRunRequest,
  ContextBlock,
  ContextProvider,
} from "@kernel/types/agent-run.types.js";
import {
  DEFAULT_WORKSPACE_REPOSITORY_IDENTITY_RESOLVER,
  MemoryStore,
  SkillsLoader,
  type Config,
  type SessionProjectContext,
  type WorkspaceRepositoryIdentity,
} from "@nextclaw/core";

type BootstrapContextConfig = Config["agents"]["context"]["bootstrap"];
type BootstrapReadBudget = {
  remaining: number;
};

function truncateText(text: string, limit: number): string {
  if (limit <= 0 || text.length <= limit) {
    return text;
  }
  const omitted = text.length - limit;
  const suffix = `\n\n...[truncated ${omitted} chars]`;
  if (suffix.length >= limit) {
    return text.slice(0, limit).trimEnd();
  }
  const head = text.slice(0, limit - suffix.length).trimEnd();
  return `${head}${suffix}`;
}

export class ToolingContextProvider implements ContextProvider {
  constructor(private readonly context: ContextProviderRunContextService) {}

  provide = async (
    request: AgentRunRequest,
  ): Promise<readonly ContextBlock[]> => {
    const { toolCatalog } = await this.context.resolve(request);
    const toolLines =
      toolCatalog.length > 0
        ? toolCatalog.map(
            (tool) =>
              `- ${tool.name}: ${tool.description ?? "No description available"}`,
          )
        : ["- No tools available for this turn."];

    return [
      [
        "## Tooling",
        "Tool availability (filtered by policy):",
        "Tool names are case-sensitive. Call tools exactly as listed.",
        ...toolLines,
        "TOOLS.md does not control tool availability; it is user guidance for how to use external tools.",
        "For long waits, avoid rapid poll loops: use exec with enough yieldMs.",
        "For relative time/date scheduling requests (for example 'in 5 minutes' / '1分钟后'), first check the current local time with an available tool such as exec/date, then convert it to an absolute ISO time with timezone. Do not guess.",
        "If a task is more complex or takes longer, spawn a sub-agent. Completion is push-based: it will auto-announce when done.",
        "Do not poll `subagents list` / `sessions_list` in a loop; only check status on-demand (for intervention, debugging, or when explicitly asked).",
      ].join("\n"),
    ];
  };
}

export class WorkspaceContextProvider implements ContextProvider {
  constructor(private readonly context: ContextProviderRunContextService) {}

  provide = async (
    request: AgentRunRequest,
  ): Promise<readonly ContextBlock[]> => {
    const { runContext } = await this.context.resolve(request);
    return [
      [
        "## Workspace",
        `Your working directory is: ${runContext.effectiveWorkspace}`,
        "Treat this directory as the single global workspace for file operations unless explicitly instructed otherwise.",
      ].join("\n"),
    ];
  };
}

export class ProjectContextProvider implements ContextProvider {
  constructor(private readonly context: ContextProviderRunContextService) {}

  provide = async (
    request: AgentRunRequest,
  ): Promise<readonly ContextBlock[]> => {
    const { contextConfig, projectContext, runContext } =
      await this.context.resolve(request);
    const budget = this.createReadBudget(contextConfig.bootstrap);
    const projectBootstrap = this.loadBootstrapFiles({
      root:
        projectContext.projectBootstrapRoot ??
        projectContext.effectiveWorkspace,
      config: contextConfig.bootstrap,
      sessionKey: runContext.sessionKey,
      budget,
    });
    const hasDistinctHostWorkspace =
      projectContext.hostWorkspace !== projectContext.effectiveWorkspace;
    const repositoryIdentity =
      DEFAULT_WORKSPACE_REPOSITORY_IDENTITY_RESOLVER.resolve(
        projectContext.effectiveWorkspace,
      );
    const hostBootstrap = hasDistinctHostWorkspace
      ? this.loadBootstrapFiles({
          root: projectContext.hostWorkspace,
          config: contextConfig.bootstrap,
          sessionKey: runContext.sessionKey,
          budget,
        })
      : "";
    const hasSoulFile = /##\s+SOUL\.md\b/i.test(
      `${projectBootstrap}\n${hostBootstrap}`,
    );
    const sections = [
      this.buildProjectSection({
        projectContext,
        projectBootstrap,
        hasSoulFile,
        repositoryIdentity,
      }),
    ];

    if (hasDistinctHostWorkspace) {
      sections.push(
        this.buildHostWorkspaceSection({
          hostWorkspace: projectContext.hostWorkspace,
          hostBootstrap,
        }),
      );
    }

    return [sections.filter(Boolean).join("\n\n")];
  };

  private buildProjectSection = (params: {
    projectContext: SessionProjectContext;
    projectBootstrap: string;
    hasSoulFile: boolean;
    repositoryIdentity: WorkspaceRepositoryIdentity;
  }): string => {
    const {
      projectContext,
      projectBootstrap,
      hasSoulFile,
      repositoryIdentity,
    } = params;
    const lines = [
      "# Project Context",
      "",
      `Active project directory: ${projectContext.effectiveWorkspace}`,
    ];

    if (projectContext.projectRoot) {
      lines.push(
        `Session-bound project root: ${projectContext.projectRoot}`,
        "This session is explicitly bound to that project directory. Use it as the primary repo and file-operation context for the user's work.",
      );
    } else {
      lines.push(
        "No explicit session project root is set. Use the active project directory as the primary repo and file-operation context for the user's work.",
      );
    }

    lines.push(...this.buildRepositoryIdentityLines(repositoryIdentity));

    if (hasSoulFile) {
      lines.push(
        "If SOUL.md is present, embody its persona and tone unless higher-priority instructions override it.",
      );
    }

    if (projectBootstrap) {
      lines.push("", "Project bootstrap files loaded:", "", projectBootstrap);
    } else {
      lines.push(
        "",
        "No bootstrap context files were found in the active project directory.",
      );
    }

    return lines.join("\n");
  };

  private buildRepositoryIdentityLines = (
    repositoryIdentity: WorkspaceRepositoryIdentity,
  ): string[] => {
    if (!repositoryIdentity.repoRoot) {
      return [
        "No Git repository metadata was detected for the active project directory. Do not assume external repository URLs refer to this project unless the user explicitly says so.",
      ];
    }

    const lines = [`Repository root: ${repositoryIdentity.repoRoot}`];

    if (repositoryIdentity.canonicalWebUrl) {
      lines.push(`Canonical repository: ${repositoryIdentity.canonicalWebUrl}`);
    } else if (repositoryIdentity.canonicalRemoteUrl) {
      const remoteLabel = repositoryIdentity.canonicalRemoteName
        ? ` (${repositoryIdentity.canonicalRemoteName})`
        : "";
      lines.push(
        `Canonical git remote${remoteLabel}: ${repositoryIdentity.canonicalRemoteUrl}`,
      );
    }

    lines.push(
      "Repository identity rule: treat any other repository URL mentioned in this context as an external reference unless it exactly matches the canonical repository above.",
    );

    return lines;
  };

  private buildHostWorkspaceSection = (params: {
    hostWorkspace: string;
    hostBootstrap: string;
  }): string => {
    const lines = [
      "# Host Workspace Context",
      "",
      `NextClaw host workspace directory: ${params.hostWorkspace}`,
      "This host workspace remains relevant for runtime memory, workspace-local skills, and host bootstrap context.",
    ];

    if (params.hostBootstrap) {
      lines.push(
        "",
        "Host workspace bootstrap files loaded:",
        "",
        params.hostBootstrap,
      );
    } else {
      lines.push(
        "",
        "No bootstrap context files were found in the host workspace directory.",
      );
    }

    return lines.join("\n");
  };

  private loadBootstrapFiles = (params: {
    root: string;
    config: BootstrapContextConfig;
    sessionKey?: string;
    budget: BootstrapReadBudget;
  }): string => {
    const { budget, config, root, sessionKey } = params;
    const parts: string[] = [];
    const fileList = this.selectBootstrapFiles(config, sessionKey);

    for (const filename of fileList) {
      const filePath = join(root, filename);
      if (!existsSync(filePath)) {
        continue;
      }

      const raw = readFileSync(filePath, "utf-8").trim();
      if (!raw) {
        continue;
      }

      const perFileLimit =
        config.perFileChars > 0 ? config.perFileChars : raw.length;
      const allowed = Math.min(perFileLimit, budget.remaining);
      if (allowed <= 0) {
        break;
      }

      const content = truncateText(raw, allowed);
      parts.push(`## ${filename}\n\n${content}`);
      budget.remaining -= content.length;
      if (budget.remaining <= 0) {
        break;
      }
    }

    return parts.join("\n\n");
  };

  private createReadBudget = (
    config: BootstrapContextConfig,
  ): BootstrapReadBudget => ({
    remaining:
      config.totalChars > 0 ? config.totalChars : Number.POSITIVE_INFINITY,
  });

  private selectBootstrapFiles = (
    config: BootstrapContextConfig,
    sessionKey?: string,
  ): string[] => {
    if (!sessionKey) {
      return config.files;
    }
    if (sessionKey.startsWith("cron:") || sessionKey.startsWith("subagent:")) {
      return config.minimalFiles;
    }
    return config.files;
  };
}

export class WorkspaceMemoryContextProvider implements ContextProvider {
  constructor(private readonly context: ContextProviderRunContextService) {}

  provide = async (
    request: AgentRunRequest,
  ): Promise<readonly ContextBlock[]> => {
    const { contextConfig, projectContext } =
      await this.context.resolve(request);
    const memoryConfig = contextConfig.memory;
    if (!memoryConfig.enabled) {
      return [];
    }

    const memory = new MemoryStore(
      projectContext.hostWorkspace,
    ).getMemoryContext();
    if (!memory) {
      return [];
    }

    return [`# Memory\n\n${truncateText(memory, memoryConfig.maxChars)}`];
  };
}

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

function normalizeModel(model?: string | null): string {
  return model?.trim().toLowerCase() ?? "";
}

function isOpenAiOrCodexModel(model?: string | null): boolean {
  return /(gpt[-/ ]?5|gpt[-/ ]?4|gpt\b|chatgpt|openai|codex|\bo[134]\b)/i.test(
    normalizeModel(model),
  );
}

function isGoogleModel(model?: string | null): boolean {
  return /(gemini|google)/i.test(normalizeModel(model));
}

function buildSection(title: string, lines: string[]): string {
  return [title, ...lines].join("\n");
}

const TOOL_USE_ENFORCEMENT_LINES = [
  "- When you say you will inspect, run, read, search, edit, or verify something, call the matching tool in the same turn.",
  "- Do not stop at promises like 'I'll check' or 'I will do that' unless the tool call already happened in that turn.",
  "- If the task can still move forward with available tools, continue instead of ending early.",
];

const OPENAI_CODEX_DISCIPLINE_LINES = [
  "- Do not guess time, date, system state, file contents, git state, or other current facts. Check with tools first.",
  "- When the default scope is already clear, act on it before asking an avoidable clarification question.",
  "- If the first tool result is empty or incomplete, retry once with a different strategy before stopping.",
];

const GOOGLE_MODEL_GUIDANCE_LINES = [
  "- Batch independent reads when possible.",
  "- Read the surrounding context before editing files.",
  "- Use explicit file paths and keep the answer focused on results.",
];

function renderSystemExecutionPolicy(model?: string | null): string {
  const sections = [
    buildSection("## Tool Use Enforcement", TOOL_USE_ENFORCEMENT_LINES),
  ];

  if (isOpenAiOrCodexModel(model)) {
    sections.push(
      buildSection(
        "## OpenAI/Codex Execution Discipline",
        OPENAI_CODEX_DISCIPLINE_LINES,
      ),
    );
  } else if (isGoogleModel(model)) {
    sections.push(
      buildSection(
        "## Google Model Operational Guidance",
        GOOGLE_MODEL_GUIDANCE_LINES,
      ),
    );
  }

  return sections.join("\n\n");
}

export class ExecutionPolicyContextProvider implements ContextProvider {
  constructor(private readonly context: ContextProviderRunContextService) {}

  provide = async (
    request: AgentRunRequest,
  ): Promise<readonly ContextBlock[]> => {
    const { runContext } = await this.context.resolve(request);
    return [renderSystemExecutionPolicy(runContext.effectiveModel)];
  };
}

export class CurrentSessionContextProvider implements ContextProvider {
  constructor(private readonly context: ContextProviderRunContextService) {}

  provide = async (
    request: AgentRunRequest,
  ): Promise<readonly ContextBlock[]> => {
    const { runContext } = await this.context.resolve(request);
    const lines = [
      "## Current Session",
      `Channel: ${runContext.channel}`,
      `Chat ID: ${runContext.chatId}`,
      `Session: ${runContext.sessionKey}`,
    ];
    if (runContext.runtimeThinking) {
      lines.push(`Thinking policy: ${runContext.runtimeThinking}`);
    }
    return [lines.join("\n")];
  };
}
