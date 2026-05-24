import {
  buildToolCatalogEntries,
  buildMinimalSystemExecutionPrompt,
  ContextBuilder,
  InputBudgetPruner,
  readSessionProjectRoot,
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
  toLegacyMessages,
} from "@kernel/utils/ncp-message-bridge.utils.js";
import { buildCurrentTurnState } from "@kernel/features/native-runtime/utils/nextclaw-ncp-current-turn.utils.js";
import { projectNcpMessagesWithContextCompaction } from "@kernel/features/context-compaction/index.js";
import {
  type ToolRuntimeRegistry,
} from "@kernel/managers/tool.manager.js";
import {
  buildSessionOrchestrationSection,
  resolveNextclawNcpRunContext,
  type NextclawNcpResolvedRunContext,
} from "@kernel/features/native-runtime/utils/nextclaw-ncp-run-context.utils.js";

type NextclawNcpContextBuilderOptions = {
  agentId?: string;
  toolRegistry: ToolRuntimeRegistry;
  configManager: ConfigManager;
  assetStore?: LocalAssetStore | null;
};

type PreparedRunContext = NextclawNcpResolvedRunContext & {
  currentTurn: ReturnType<typeof buildCurrentTurnState>;
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
    const requestMetadata = mergeInputMetadata(input);
    const resolved = resolveNextclawNcpRunContext({
      configManager: this.options.configManager,
      sessionId: input.sessionId,
      requestMetadata,
      sessionMetadata: requestMetadata,
      storedAgentId: this.options.agentId,
    });
    const currentTurn = buildCurrentTurnState({
      input,
      currentModel: resolved.effectiveModel,
      formatPrompt: ({ text, timestamp }) =>
        appendTimeHintForPrompt(
          prependRequestedSkills(text, resolved.requestedSkills.selectors),
          timestamp,
        ),
      assetStore: this.options.assetStore,
    });

    this.options.toolRegistry.prepareForRun(resolved.toolRunContext);

    return {
      ...resolved,
      currentTurn,
      effectiveModel: currentTurn.effectiveModel,
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
