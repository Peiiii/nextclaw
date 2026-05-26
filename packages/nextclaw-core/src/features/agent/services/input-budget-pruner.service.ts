const DEFAULT_CONTEXT_TOKENS = 200_000;
const DEFAULT_RESERVE_TOKENS_FLOOR = 20_000;
const DEFAULT_SOFT_THRESHOLD_TOKENS = 4_000;
const DEFAULT_CHARS_PER_TOKEN = 4;
const MAX_TOOL_RESULT_CONTEXT_SHARE = 0.3;
const HARD_MAX_TOOL_RESULT_CHARS = 400_000;
const TOOL_RESULT_TRUNCATION_SUFFIX =
  "\n\n⚠️ [Tool result truncated to fit input context budget.]";
const CONTEXT_TRUNCATION_SUFFIX = "\n\n⚠️ [Context truncated to fit model input budget.]";
const MIN_SYSTEM_KEEP_CHARS = 2_000;
const MIN_USER_KEEP_CHARS = 1_000;

type RuntimeMessage = Record<string, unknown>;

export type InputBudgetEstimate = {
  estimatedTokens: number;
  budgetTokens: number;
};

type InputBudgetPruneState = {
  work: RuntimeMessage[];
  contextTokens: number;
  budgetTokens: number;
  droppedHistoryCount: number;
  truncatedToolResultCount: number;
  truncatedSystemPrompt: boolean;
  truncatedUserMessage: boolean;
};

export type InputBudgetPruneResult = {
  messages: RuntimeMessage[];
  estimatedTokens: number;
  budgetTokens: number;
  droppedHistoryCount: number;
  truncatedToolResultCount: number;
  truncatedSystemPrompt: boolean;
  truncatedUserMessage: boolean;
};

export type InputBudgetPrepareResult = InputBudgetPruneResult;

export class InputBudgetPruner {
  estimate = (params: {
    messages: RuntimeMessage[];
    contextTokens?: number | null;
    reserveTokensFloor?: number;
    softThresholdTokens?: number;
  }): InputBudgetEstimate => {
    return {
      estimatedTokens: estimateTokens(params.messages),
      budgetTokens: this.resolveBudgetTokens(params),
    };
  };

  prepareForBudget = (params: {
    messages: RuntimeMessage[];
    contextTokens?: number | null;
    reserveTokensFloor?: number;
    softThresholdTokens?: number;
  }): InputBudgetPrepareResult => {
    const state = this.createPruneState(params);
    this.prepareStateForBudget(state);
    return this.toPruneResult(state);
  };

  prune = (params: {
    messages: RuntimeMessage[];
    contextTokens?: number | null;
    reserveTokensFloor?: number;
    softThresholdTokens?: number;
  }): InputBudgetPruneResult => {
    const state = this.createPruneState(params);
    this.prepareStateForBudget(state);
    this.dropOldHistoryUntilWithinBudget(state);
    this.truncateBoundaryMessagesUntilWithinBudget(state);
    return this.toPruneResult(state);
  };

  private toPruneResult = (state: InputBudgetPruneState): InputBudgetPruneResult => {
    return {
      messages: state.work,
      estimatedTokens: estimateTokens(state.work),
      budgetTokens: state.budgetTokens,
      droppedHistoryCount: state.droppedHistoryCount,
      truncatedToolResultCount: state.truncatedToolResultCount,
      truncatedSystemPrompt: state.truncatedSystemPrompt,
      truncatedUserMessage: state.truncatedUserMessage
    };
  };

  private createPruneState = (params: {
    messages: RuntimeMessage[];
    contextTokens?: number | null;
    reserveTokensFloor?: number;
    softThresholdTokens?: number;
  }): InputBudgetPruneState => {
    const contextTokens = this.resolveContextTokens(params.contextTokens);
    return {
      work: params.messages.map((message) => structuredClone(message)),
      contextTokens,
      budgetTokens: this.resolveBudgetTokens(params),
      droppedHistoryCount: 0,
      truncatedToolResultCount: 0,
      truncatedSystemPrompt: false,
      truncatedUserMessage: false
    };
  };

  private truncateToolResults = (state: InputBudgetPruneState): void => {
    const maxToolResultChars = Math.min(
      HARD_MAX_TOOL_RESULT_CHARS,
      Math.max(2_000, Math.floor(state.contextTokens * MAX_TOOL_RESULT_CONTEXT_SHARE * DEFAULT_CHARS_PER_TOKEN))
    );

    for (let index = 0; index < state.work.length; index += 1) {
      const message = state.work[index];
      const content = typeof message.content === "string" ? message.content : "";
      if (message.role !== "tool" || !content || content.length <= maxToolResultChars) {
        continue;
      }
      state.work[index] = {
        ...message,
        content: truncateText(content, maxToolResultChars, TOOL_RESULT_TRUNCATION_SUFFIX)
      };
      state.truncatedToolResultCount += 1;
    }
  };

  private prepareStateForBudget = (state: InputBudgetPruneState): void => {
    this.truncateToolResults(state);
    this.dropOrphanToolResults(state);
  };

  private pruneToolPairsUntilWithinBudget = (state: InputBudgetPruneState): void => {
    while (estimateTokens(state.work) > state.budgetTokens) {
      const assistantIndex = state.work.findIndex(hasToolCalls);
      if (assistantIndex < 0) {
        break;
      }
      this.removeAssistantToolProtocol(state, assistantIndex);
    }
  };

  private dropOldHistoryUntilWithinBudget = (state: InputBudgetPruneState): void => {
    this.pruneToolPairsUntilWithinBudget(state);
    while (estimateTokens(state.work) > state.budgetTokens && state.work.length > 2) {
      state.work.splice(1, 1);
      state.droppedHistoryCount += 1;
    }
    this.dropOrphanToolResults(state);
  };

  private removeAssistantToolProtocol = (state: InputBudgetPruneState, index: number): void => {
    const toolCallIds = getToolCallIds(state.work[index]);
    for (let resultIndex = state.work.length - 1; resultIndex >= 0; resultIndex -= 1) {
      const resultToolCallId = readToolCallId(state.work[resultIndex]);
      if (resultToolCallId && toolCallIds.includes(resultToolCallId)) {
        state.work.splice(resultIndex, 1);
        state.droppedHistoryCount += 1;
      }
    }
    const assistant = stripAssistantToolCallFields(state.work[index]);
    if (hasRenderableContent(assistant.content)) {
      state.work[index] = assistant;
    } else {
      state.work.splice(index, 1);
      state.droppedHistoryCount += 1;
    }
  };

  private dropOrphanToolResults = (state: InputBudgetPruneState): void => {
    const toolCallIds = new Set(state.work.flatMap(getToolCallIds));
    const toolResultIds = new Set<string>();
    for (let index = state.work.length - 1; index >= 0; index -= 1) {
      const toolCallId = readToolCallId(state.work[index]);
      if (state.work[index].role === "tool" && (!toolCallId || !toolCallIds.has(toolCallId))) {
        state.work.splice(index, 1);
        state.droppedHistoryCount += 1;
        continue;
      }
      if (toolCallId) {
        toolResultIds.add(toolCallId);
      }
    }

    for (let index = state.work.length - 1; index >= 0; index -= 1) {
      const missingToolCallIds = getToolCallIds(state.work[index]).filter((id) => !toolResultIds.has(id));
      if (missingToolCallIds.length === 0) {
        continue;
      }
      state.work.splice(
        index + 1,
        0,
        ...missingToolCallIds.map((toolCallId) => ({
          role: "tool",
          tool_call_id: toolCallId,
          content: "[Tool execution was interrupted before a result was recorded.]"
        }))
      );
      missingToolCallIds.forEach((toolCallId) => toolResultIds.add(toolCallId));
    }
  };

  private truncateBoundaryMessagesUntilWithinBudget = (state: InputBudgetPruneState): void => {
    let guard = 0;
    while (estimateTokens(state.work) > state.budgetTokens && guard < 8) {
      guard += 1;
      if (this.truncateSystemPrompt(state)) {
        continue;
      }
      if (this.truncateLastUserMessage(state)) {
        continue;
      }
      break;
    }
  };

  private truncateSystemPrompt = (state: InputBudgetPruneState): boolean => {
    const systemIndex = state.work.findIndex((message) => message.role === "system");
    if (systemIndex < 0) {
      return false;
    }
    const systemContent = typeof state.work[systemIndex].content === "string" ? state.work[systemIndex].content : "";
    if (systemContent.length <= MIN_SYSTEM_KEEP_CHARS) {
      return false;
    }
    state.work[systemIndex] = {
      ...state.work[systemIndex],
      content: truncateText(systemContent, Math.max(MIN_SYSTEM_KEEP_CHARS, Math.floor(systemContent.length * 0.8)))
    };
    state.truncatedSystemPrompt = true;
    return true;
  };

  private truncateLastUserMessage = (state: InputBudgetPruneState): boolean => {
    const userIndex = findLastIndex(state.work, (message) => message.role === "user");
    if (userIndex < 0) {
      return false;
    }
    const userContent = typeof state.work[userIndex].content === "string" ? state.work[userIndex].content : "";
    if (userContent.length <= MIN_USER_KEEP_CHARS) {
      return false;
    }
    state.work[userIndex] = {
      ...state.work[userIndex],
      content: truncateText(userContent, Math.max(MIN_USER_KEEP_CHARS, Math.floor(userContent.length * 0.8)))
    };
    state.truncatedUserMessage = true;
    return true;
  };

  private resolveBudgetTokens = (params: {
    contextTokens?: number | null;
    reserveTokensFloor?: number;
    softThresholdTokens?: number;
  }): number => {
    const contextTokens = this.resolveContextTokens(params.contextTokens);
    const reserveTokens = sanitizeInt(params.reserveTokensFloor, 0) ?? DEFAULT_RESERVE_TOKENS_FLOOR;
    const softThreshold = sanitizeInt(params.softThresholdTokens, 0) ?? DEFAULT_SOFT_THRESHOLD_TOKENS;
    return Math.max(1, contextTokens - reserveTokens - softThreshold);
  };

  private resolveContextTokens = (value: number | null | undefined): number => {
    return sanitizeInt(value, 1) ?? DEFAULT_CONTEXT_TOKENS;
  };
}

function sanitizeInt(value: unknown, min: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const normalized = Math.floor(value);
  return normalized >= min ? normalized : null;
}

function hasToolCalls(message: RuntimeMessage): boolean {
  return getToolCallIds(message).length > 0;
}

function stripAssistantToolCallFields(message: RuntimeMessage): RuntimeMessage {
  const stripped: RuntimeMessage = {};
  for (const [key, value] of Object.entries(message)) {
    if (key === "tool_calls" || key === "reasoning_content") {
      continue;
    }
    stripped[key] = value;
  }
  return stripped;
}

function getToolCallIds(message: RuntimeMessage): string[] {
  const toolCalls = message.tool_calls;
  if (!Array.isArray(toolCalls)) {
    return [];
  }
  return toolCalls.flatMap((toolCall) => {
    if (!toolCall || typeof toolCall !== "object" || Array.isArray(toolCall)) {
      return [];
    }
    const id = (toolCall as { id?: unknown }).id;
    return typeof id === "string" && id.length > 0 ? [id] : [];
  });
}

function readToolCallId(message: RuntimeMessage): string | null {
  const id = message.tool_call_id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function hasRenderableContent(content: unknown): boolean {
  return typeof content === "string" ? content.trim().length > 0 : estimateChars(content) > 0;
}

function estimateTokens(messages: RuntimeMessage[]): number {
  const totalChars = messages.reduce((sum, message) => sum + estimateChars(message), 0);
  return Math.ceil(totalChars / DEFAULT_CHARS_PER_TOKEN);
}

function estimateChars(value: unknown): number {
  if (typeof value === "string") {
    return value.length;
  }
  if (typeof value === "number") {
    return String(value).length;
  }
  if (typeof value === "boolean") {
    return value ? 4 : 5;
  }
  if (!value) {
    return 0;
  }
  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + estimateChars(item), 0);
  }
  if (typeof value === "object") {
    return Object.entries(value).reduce((sum, [key, nested]) => sum + key.length + estimateChars(nested), 0);
  }
  return 0;
}

function truncateText(text: string, maxChars: number, suffix = CONTEXT_TRUNCATION_SUFFIX): string {
  if (text.length <= maxChars) {
    return text;
  }
  const safeMax = Math.max(64, maxChars);
  if (safeMax <= suffix.length + 16) {
    return text.slice(0, safeMax);
  }
  const keep = safeMax - suffix.length;
  return `${text.slice(0, keep).trimEnd()}${suffix}`;
}

function findLastIndex<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) {
      return index;
    }
  }
  return -1;
}
