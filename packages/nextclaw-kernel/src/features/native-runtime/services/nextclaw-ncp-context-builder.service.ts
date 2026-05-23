import {
  buildToolCatalogEntries,
  buildMinimalSystemExecutionPrompt,
  ContextBuilder,
  ContextWindowBudgetService,
  findEffectiveAgentProfile,
  InputBudgetPruner,
  RequestedSkillsMetadataReader,
  getWorkspacePath,
  parseThinkingLevel,
  readSessionProjectRoot,
  resolveDefaultAgentProfileId,
  resolveSessionWorkspacePath,
  resolveThinkingLevel,
  type Config,
} from "@nextclaw/core";
import type { ConfigManager } from "@kernel/managers/config.manager.js";
import {
  buildOpenAiFunctionTool,
  type LocalAssetStore,
} from "@nextclaw/ncp-agent-runtime";
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
} from "@kernel/utils/ncp-message-bridge.utils.js";
import {
  resolveEffectiveModel,
  resolveSessionChannelContext,
} from "@kernel/features/native-runtime/utils/nextclaw-ncp-session-preferences.utils.js";
import { buildCurrentTurnState } from "@kernel/features/native-runtime/utils/nextclaw-ncp-current-turn.utils.js";
import { projectNcpMessagesWithContextCompaction } from "@kernel/features/context-compaction/index.js";
import {
  resolveAgentHandoffDepth,
  type ToolRuntimeRegistry,
} from "@kernel/managers/tool.manager.js";

type NextclawNcpContextBuilderOptions = {
  agentId?: string;
  toolRegistry: ToolRuntimeRegistry;
  configManager: ConfigManager;
  assetStore?: LocalAssetStore | null;
};

type ResolvedAgentProfile = {
  agentId: string;
  contextTokens: number;
  execTimeoutSeconds: number;
  model: string;
  reservedContextTokens: number;
  restrictToWorkspace: boolean;
  searchConfig: Config["search"];
  workspace: string;
};

type PreparedRunContext = {
  channel: string;
  chatId: string;
  config: Config;
  currentTurn: ReturnType<typeof buildCurrentTurnState>;
  effectiveModel: string;
  effectiveWorkspace: string;
  profile: ResolvedAgentProfile;
  requestMetadata: Record<string, unknown>;
  requestedSkills: ReturnType<RequestedSkillsMetadataReader["readSelection"]>;
  requestedToolNames: string[];
  runtimeThinking: ReturnType<typeof resolveThinkingLevel>;
  sessionMetadata: Record<string, unknown>;
  sessionKey: string;
};

type BuiltNcpModelMessages = {
  messages: Record<string, unknown>[];
  toolDefinitions: readonly NcpToolDefinition[];
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

const REQUESTED_SKILLS_METADATA_READER = new RequestedSkillsMetadataReader();

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

function readRequestedAgentId(metadata: Record<string, unknown>): string | null {
  return normalizeString(metadata.agent_id)?.toLowerCase() ?? normalizeString(metadata.agentId)?.toLowerCase() ?? null;
}

function resolveAgentProfile(params: {
  config: Config;
  storedAgentId?: string;
  requestMetadata: Record<string, unknown>;
}): ResolvedAgentProfile {
  const { config, requestMetadata, storedAgentId } = params;
  const {
    agents: { defaults },
    search: searchConfig,
    tools: {
      restrictToWorkspace,
      exec: { timeout: execTimeoutSeconds },
    },
  } = config;
  const defaultAgentId = resolveDefaultAgentProfileId(config);
  const candidateAgentId =
    normalizeString(storedAgentId)?.toLowerCase() ??
    readRequestedAgentId(requestMetadata) ??
    defaultAgentId;
  const profile =
    findEffectiveAgentProfile(config, candidateAgentId) ??
    findEffectiveAgentProfile(config, defaultAgentId);
  if (!profile) {
    throw new Error(`default agent profile not found: ${defaultAgentId}`);
  }
  const contextTokens = profile.contextTokens ?? defaults.contextTokens;
  return {
    agentId: profile.id,
    workspace: getWorkspacePath(profile.workspace ?? defaults.workspace),
    model: profile.model ?? defaults.model,
    contextTokens,
    reservedContextTokens: ContextWindowBudgetService.resolveReservedContextTokens({
      contextTokens,
      configuredReservedContextTokens: profile.reservedContextTokens ?? defaults.reservedContextTokens,
    }),
    restrictToWorkspace,
    searchConfig,
    execTimeoutSeconds,
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

function prependRequestedSkills(content: string, requestedSkillSelectors: string[]): string {
  if (requestedSkillSelectors.length === 0) {
    return content;
  }
  return `[Requested skills for this turn: ${requestedSkillSelectors.join(", ")}]\n\n${content}`;
}

function buildSessionOrchestrationSection(): string {
  return [
    "## Session Orchestration",
    "- Before passing a non-default `runtime` to `sessions_spawn` or agent creation/update flows, inspect the installed runtime kinds with `nextclaw agents runtimes --json`.",
    "- `sessions_spawn` is the unified session-creation tool. Omit `scope` or use `scope=\"standalone\"` for a regular session, and use `scope=\"child\"` when the new session should be a child session of the current flow.",
    "- `sessions_spawn` only creates the session by default. Add top-level `notify: \"none\" | \"final_reply\"` when the new session should start working immediately.",
    "- When `sessions_spawn.scope=\"child\"` and `sessions_spawn.notify=\"final_reply\"`, the new child session starts right away and this session automatically continues after that child reaches its final reply.",
    "- Use `sessions_spawn` without `notify` when the user wants a separate thread created now but does not need it to start working yet.",
    "- Use `sessions_request` to send one task to an existing session, including a session that was just created by `sessions_spawn` or a previously created child session.",
    "- `sessions_request.target` must be an object shaped like `{ \"session_id\": \"<target-session-id>\" }`. Do not pass a bare string.",
    "- Prefer `notify=\"final_reply\"` when the current session should continue after the target session produces its final reply. Use `notify=\"none\"` when you only want the target session to run independently.",
  ].join("\n");
}

function buildRequestedOpenAiTools(
  toolDefinitions: ReadonlyArray<NcpToolDefinition>,
  requestedToolNames: string[],
): OpenAITool[] | undefined {
  const tools = toolDefinitions.map(buildOpenAiFunctionTool);
  if (tools.length === 0) {
    return undefined;
  }
  if (requestedToolNames.length === 0) {
    return tools;
  }
  const requested = new Set(requestedToolNames);
  const filtered = tools.filter((tool) => requested.has(tool.function.name));
  return filtered.length > 0 ? filtered : undefined;
}

export class NextclawNcpContextBuilder implements NcpContextBuilder {
  private readonly inputBudgetPruner = new InputBudgetPruner();

  constructor(
    private readonly options: NextclawNcpContextBuilderOptions,
  ) {}

  prepare = (input: NcpAgentRunInput, _options?: NcpContextPrepareOptions): NcpLLMApiInput => {
    const runContext = this.prepareRunContext(input);
    const modelMessages = this.buildModelMessages(input, _options, runContext);
    const pruned = this.pruneModelMessages(runContext, modelMessages);

    return {
      messages: pruned.messages as OpenAIChatMessage[],
      tools: buildRequestedOpenAiTools(modelMessages.toolDefinitions, runContext.requestedToolNames),
      model: runContext.effectiveModel,
      thinkingLevel: runContext.runtimeThinking,
    };
  };

  private prepareRunContext = (input: NcpAgentRunInput): PreparedRunContext => {
    const config = this.options.configManager.loadConfig();
    const requestMetadata = mergeInputMetadata(input);
    const sessionMetadata = structuredClone(requestMetadata);
    const profile = resolveAgentProfile({
      config,
      storedAgentId: this.options.agentId,
      requestMetadata,
    });
    let { model: effectiveModel } = resolveEffectiveModel({
      sessionMetadata,
      requestMetadata,
      fallbackModel: profile.model,
    });
    const effectiveWorkspace = resolveSessionWorkspacePath({
      sessionMetadata,
      workspace: profile.workspace,
    });
    const { channel, chatId } = resolveSessionChannelContext({
      sessionMetadata,
      requestMetadata,
    });
    const requestedSkills = REQUESTED_SKILLS_METADATA_READER.readSelection(requestMetadata);
    const currentTurn = buildCurrentTurnState({
      input,
      currentModel: effectiveModel,
      formatPrompt: ({ text, timestamp }) =>
        appendTimeHintForPrompt(
          prependRequestedSkills(text, requestedSkills.selectors),
          timestamp,
        ),
      assetStore: this.options.assetStore,
    });
    effectiveModel = currentTurn.effectiveModel;
    const runtimeThinking = resolveThinkingLevel({
      config,
      agentId: profile.agentId,
      model: effectiveModel,
      sessionThinkingLevel: parseThinkingLevel(sessionMetadata.preferred_thinking) ?? null,
    });

    this.options.toolRegistry.prepareForRun({
      sessionId: input.sessionId,
      channel,
      chatId,
      agentId: profile.agentId,
      config,
      execTimeoutSeconds: profile.execTimeoutSeconds,
      handoffDepth: resolveAgentHandoffDepth(requestMetadata),
      metadata: requestMetadata,
      restrictToWorkspace: profile.restrictToWorkspace,
      searchConfig: profile.searchConfig,
      workspace: effectiveWorkspace,
    });

    return {
      channel,
      chatId,
      config,
      currentTurn,
      effectiveModel,
      effectiveWorkspace,
      profile,
      requestMetadata,
      requestedSkills,
      requestedToolNames: resolveRequestedToolNames(requestMetadata),
      runtimeThinking,
      sessionMetadata,
      sessionKey: input.sessionId,
    };
  };

  private buildModelMessages = (
    input: NcpAgentRunInput,
    _options: NcpContextPrepareOptions | undefined,
    runContext: PreparedRunContext,
  ): BuiltNcpModelMessages => {
    const {
      channel,
      chatId,
      config,
      currentTurn,
      effectiveModel,
      effectiveWorkspace,
      profile,
      requestedSkills,
      runtimeThinking,
      sessionMetadata,
    } = runContext;
    const toolDefinitions = this.options.toolRegistry.getToolDefinitions();
    const additionalSystemSections = [
      buildSessionOrchestrationSection(),
      buildMinimalSystemExecutionPrompt(effectiveModel),
    ].filter(Boolean);

    const contextBuilder = new ContextBuilder(
      effectiveWorkspace,
      config.agents.context,
      {
        hostWorkspace: profile.workspace,
        sessionProjectRoot: readSessionProjectRoot(sessionMetadata),
      },
    );
    const sessionMessages = projectNcpMessagesWithContextCompaction({
      sessionId: input.sessionId,
      sessionMessages: _options?.sessionMessages ?? [],
    });
    const messages = contextBuilder.buildMessages({
      history: toLegacyMessages([...sessionMessages], {
        assetStore: this.options.assetStore,
        serviceRole: "system",
      }),
      currentMessage: "",
      channel,
      chatId,
      sessionKey: input.sessionId,
      thinkingLevel: runtimeThinking,
      skillNames: requestedSkills.selectors,
      availableTools: buildToolCatalogEntries(toolDefinitions),
      additionalSystemSections,
    });
    messages[messages.length - 1] = {
      role: currentTurn.currentRole,
      content: currentTurn.currentUserContent,
    };
    return {
      messages,
      toolDefinitions,
    };
  };

  private pruneModelMessages = (
    runContext: PreparedRunContext,
    modelMessages: BuiltNcpModelMessages,
  ) => {
    return this.inputBudgetPruner.prune({
      messages: modelMessages.messages,
      contextTokens: runContext.profile.contextTokens,
      reserveTokensFloor: runContext.profile.reservedContextTokens,
      softThresholdTokens: 0,
    });
  };
}
