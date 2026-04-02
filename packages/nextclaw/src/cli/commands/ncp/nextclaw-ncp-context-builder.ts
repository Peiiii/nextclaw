import {
  buildToolCatalogEntries,
  ContextBuilder,
  InputBudgetPruner,
  getWorkspacePath,
  parseThinkingLevel,
  readSessionProjectRoot,
  resolveSessionWorkspacePath,
  resolveThinkingLevel,
  type Config,
  type SessionManager,
} from "@nextclaw/core";
import type { LocalAssetStore } from "@nextclaw/ncp-agent-runtime";
import type {
  NcpAgentRunInput,
  NcpContextBuilder,
  NcpContextPrepareOptions,
  NcpLLMApiInput,
  NcpToolDefinition,
  OpenAIChatMessage,
  OpenAITool,
} from "@nextclaw/ncp";
import {
  normalizeString,
  toLegacyMessages,
} from "./nextclaw-ncp-message-bridge.js";
import {
  resolveEffectiveModel,
  resolveSessionChannelContext,
  syncSessionThinkingPreference,
} from "./nextclaw-ncp-session-preferences.js";
import { buildCurrentTurnState } from "./nextclaw-ncp-current-turn.js";
import {
  readAccountIdForHints,
  resolveAgentHandoffDepth,
} from "./nextclaw-ncp-tool-registry.js";
import type { NextclawNcpToolRegistry } from "./nextclaw-ncp-tool-registry.js";

type MessageToolHintsResolver = (params: {
  sessionKey: string;
  channel: string;
  chatId: string;
  accountId?: string | null;
}) => string[];

type NextclawNcpContextBuilderOptions = {
  sessionManager: SessionManager;
  toolRegistry: NextclawNcpToolRegistry;
  getConfig: () => Config;
  resolveMessageToolHints?: MessageToolHintsResolver;
  assetStore?: LocalAssetStore | null;
};

type ResolvedAgentProfile = {
  agentId: string;
  contextTokens: number;
  execTimeoutSeconds: number;
  maxIterations: number;
  model: string;
  restrictToWorkspace: boolean;
  searchConfig: Config["search"];
  workspace: string;
};

const TIME_HINT_TRIGGER_PATTERNS = [
  /\b(now|right now|current time|what time|today|tonight|tomorrow|yesterday|this morning|this afternoon|this evening|date)\b/i,
  /(现在|此刻|当前时间|现在几点|几点了|今天|今晚|今早|今晨|明天|昨天|日期)/,
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeInputMetadata(input: NcpAgentRunInput): Record<string, unknown> {
  const messageMetadata = input.messages
    .slice()
    .reverse()
    .find((message) => isRecord(message.metadata))?.metadata;
  return {
    ...(isRecord(messageMetadata) ? structuredClone(messageMetadata) : {}),
    ...(isRecord(input.metadata) ? structuredClone(input.metadata) : {}),
  };
}

function resolveRequestedSkillNames(metadata: Record<string, unknown>): string[] {
  const rawValue = metadata.requested_skills ?? metadata.requestedSkills;
  const values: string[] = [];
  if (Array.isArray(rawValue)) {
    for (const item of rawValue) {
      const normalized = normalizeString(item);
      if (normalized) {
        values.push(normalized);
      }
    }
  } else if (typeof rawValue === "string") {
    values.push(
      ...rawValue
        .split(/[,\s]+/g)
        .map((item) => item.trim())
        .filter(Boolean),
    );
  }

  return Array.from(new Set(values)).slice(0, 8);
}

function resolveRequestedToolNames(metadata: Record<string, unknown>): string[] {
  const rawValue = metadata.requested_tools ?? metadata.requestedTools;
  if (!Array.isArray(rawValue)) {
    return [];
  }
  return Array.from(
    new Set(
      rawValue
        .map((item) => normalizeString(item))
        .filter((item): item is string => Boolean(item)),
    ),
  );
}

function resolvePrimaryAgentProfile(config: Config): ResolvedAgentProfile {
  const configuredDefaultAgentId =
    config.agents.list.find((entry) => entry.default)?.id?.trim() ||
    config.agents.list[0]?.id?.trim() ||
    "main";
  const profile = config.agents.list.find((entry) => entry.id.trim() === configuredDefaultAgentId);
  return {
    agentId: configuredDefaultAgentId,
    workspace: getWorkspacePath(profile?.workspace ?? config.agents.defaults.workspace),
    model: profile?.model ?? config.agents.defaults.model,
    maxIterations: profile?.maxToolIterations ?? config.agents.defaults.maxToolIterations,
    contextTokens: profile?.contextTokens ?? config.agents.defaults.contextTokens,
    restrictToWorkspace: config.tools.restrictToWorkspace,
    searchConfig: config.search,
    execTimeoutSeconds: config.tools.exec.timeout,
  };
}

function shouldAppendTimeHint(content: string): boolean {
  const normalized = content.trim();
  if (!normalized) {
    return false;
  }
  return TIME_HINT_TRIGGER_PATTERNS.some((pattern) => pattern.test(normalized));
}

function buildMinutePrecisionTimeHint(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absMinutes = Math.abs(offsetMinutes);
  const offsetHour = String(Math.floor(absMinutes / 60)).padStart(2, "0");
  const offsetMinute = String(absMinutes % 60).padStart(2, "0");
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
  return `${year}-${month}-${day} ${hour}:${minute} ${sign}${offsetHour}:${offsetMinute} (${timezone})`;
}

function appendTimeHintForPrompt(content: string, timestamp: Date): string {
  if (!shouldAppendTimeHint(content)) {
    return content;
  }
  const date = Number.isNaN(timestamp.getTime()) ? new Date() : timestamp;
  return `${content}\n\n[time_hint_local_minute] ${buildMinutePrecisionTimeHint(date)}`;
}

function prependRequestedSkills(content: string, requestedSkillNames: string[]): string {
  if (requestedSkillNames.length === 0) {
    return content;
  }
  return `[Requested skills for this turn: ${requestedSkillNames.join(", ")}]\n\n${content}`;
}

function filterTools(
  toolDefinitions: ReadonlyArray<OpenAITool>,
  requestedToolNames: string[],
): OpenAITool[] | undefined {
  if (toolDefinitions.length === 0) {
    return undefined;
  }
  if (requestedToolNames.length === 0) {
    return [...toolDefinitions];
  }
  const requested = new Set(requestedToolNames);
  const filtered = toolDefinitions.filter((tool) => requested.has(tool.function.name));
  return filtered.length > 0 ? filtered : undefined;
}

function buildRequestedOpenAiTools(
  toolDefinitions: ReadonlyArray<NcpToolDefinition>,
  requestedToolNames: string[],
): OpenAITool[] | undefined {
  return filterTools(
    toolDefinitions.map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    })),
    requestedToolNames,
  );
}

export class NextclawNcpContextBuilder implements NcpContextBuilder {
  private readonly inputBudgetPruner = new InputBudgetPruner();

  constructor(
    private readonly options: NextclawNcpContextBuilderOptions,
  ) {}

  prepare = (input: NcpAgentRunInput, _options?: NcpContextPrepareOptions): NcpLLMApiInput => {
    const config = this.options.getConfig();
    const profile = resolvePrimaryAgentProfile(config);
    const requestMetadata = mergeInputMetadata(input);
    const session = this.options.sessionManager.getOrCreate(input.sessionId);
    let effectiveModel = resolveEffectiveModel({
      session,
      requestMetadata,
      fallbackModel: profile.model,
    });
    const effectiveWorkspace = resolveSessionWorkspacePath({
      sessionMetadata: session.metadata,
      workspace: profile.workspace,
    });
    syncSessionThinkingPreference({ session, requestMetadata });
    const { channel, chatId } = resolveSessionChannelContext({
      session,
      requestMetadata,
    });

    const requestedSkillNames = resolveRequestedSkillNames(requestMetadata);
    const requestedToolNames = resolveRequestedToolNames(requestMetadata);
    const currentTurn = buildCurrentTurnState({
      input,
      currentModel: effectiveModel,
      formatPrompt: ({ text, timestamp }) =>
        appendTimeHintForPrompt(
          prependRequestedSkills(text, requestedSkillNames),
          timestamp,
        ),
      assetStore: this.options.assetStore,
    });
    effectiveModel = currentTurn.effectiveModel;
    const runtimeThinking = resolveThinkingLevel({
      config,
      agentId: profile.agentId,
      model: effectiveModel,
      sessionThinkingLevel: parseThinkingLevel(session.metadata.preferred_thinking) ?? null,
    });

    this.options.toolRegistry.prepareForRun({
      sessionId: input.sessionId,
      channel,
      chatId,
      agentId: profile.agentId,
      config,
      contextTokens: profile.contextTokens,
      execTimeoutSeconds: profile.execTimeoutSeconds,
      handoffDepth: resolveAgentHandoffDepth(requestMetadata),
      maxTokens: undefined,
      metadata: requestMetadata,
      model: effectiveModel,
      restrictToWorkspace: profile.restrictToWorkspace,
      searchConfig: profile.searchConfig,
      workspace: effectiveWorkspace,
    });

    const accountId = readAccountIdForHints(requestMetadata, session.metadata);
    const messageToolHints = this.options.resolveMessageToolHints?.({
      sessionKey: input.sessionId,
      channel,
      chatId,
      accountId: accountId ?? null,
    });
    const toolDefinitions = this.options.toolRegistry.getToolDefinitions();

    const contextBuilder = new ContextBuilder(
      effectiveWorkspace,
      config.agents.context,
      {
        hostWorkspace: profile.workspace,
        sessionProjectRoot: readSessionProjectRoot(session.metadata),
      },
    );
    const sessionMessages = _options?.sessionMessages ?? [];
    const messages = contextBuilder.buildMessages({
      history: toLegacyMessages([...sessionMessages], {
        assetStore: this.options.assetStore,
      }),
      currentMessage: "",
      attachments: [],
      channel,
      chatId,
      sessionKey: input.sessionId,
      thinkingLevel: runtimeThinking,
      skillNames: requestedSkillNames,
      messageToolHints,
      availableTools: buildToolCatalogEntries(toolDefinitions),
    });
    messages[messages.length - 1] = {
      role: currentTurn.currentRole,
      content: currentTurn.currentUserContent,
    };
    const pruned = this.inputBudgetPruner.prune({
      messages,
      contextTokens: profile.contextTokens,
    });

    return {
      messages: pruned.messages as OpenAIChatMessage[],
      tools: buildRequestedOpenAiTools(toolDefinitions, requestedToolNames),
      model: effectiveModel,
      thinkingLevel: runtimeThinking,
    };
  };
}
