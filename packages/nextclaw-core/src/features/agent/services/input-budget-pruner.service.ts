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
      work: params.messages.map(cloneMessage),
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
    this.dropInvalidToolHistory(state);
  };

  private dropInvalidToolHistory = (state: InputBudgetPruneState): void => {
    const normalized = sanitizeHistoricalToolProtocol(state.work);
    state.droppedHistoryCount += state.work.length - normalized.length;
    state.work.splice(0, state.work.length, ...normalized);
  };

  private dropOldHistoryUntilWithinBudget = (state: InputBudgetPruneState): void => {
    while (estimateTokens(state.work) > state.budgetTokens && state.work.length > 2) {
      state.work.splice(1, 1);
      state.droppedHistoryCount += 1;
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
    const reserveTokens = sanitizeNonNegativeInt(params.reserveTokensFloor) ?? DEFAULT_RESERVE_TOKENS_FLOOR;
    const softThreshold = sanitizeNonNegativeInt(params.softThresholdTokens) ?? DEFAULT_SOFT_THRESHOLD_TOKENS;
    return Math.max(1, contextTokens - reserveTokens - softThreshold);
  };

  private resolveContextTokens = (value: number | null | undefined): number => {
    return sanitizePositiveInt(value) ?? DEFAULT_CONTEXT_TOKENS;
  };
}

function sanitizePositiveInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : null;
}

function sanitizeNonNegativeInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const normalized = Math.floor(value);
  return normalized >= 0 ? normalized : null;
}

function cloneMessage(message: RuntimeMessage): RuntimeMessage {
  const cloned: RuntimeMessage = {};
  for (const [key, value] of Object.entries(message)) {
    cloned[key] = deepCloneValue(value);
  }
  return cloned;
}

function deepCloneValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => deepCloneValue(item));
  }
  if (value && typeof value === "object") {
    const cloned: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      cloned[key] = deepCloneValue(nested);
    }
    return cloned;
  }
  return value;
}

function sanitizeHistoricalToolProtocol(messages: RuntimeMessage[]): RuntimeMessage[] {
  const activeToolChainStart = findActiveToolChainStart(messages);
  const sanitized: RuntimeMessage[] = [];

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (activeToolChainStart >= 0 && index >= activeToolChainStart) {
      sanitized.push(message);
      continue;
    }

    if (message.role === "tool") {
      continue;
    }

    if (message.role === "assistant" && hasToolCalls(message)) {
      const stripped = stripAssistantToolCallFields(message);
      if (hasRenderableContent(stripped.content)) {
        sanitized.push(stripped);
      }
      continue;
    }

    sanitized.push(message);
  }

  return sanitized;
}

function findActiveToolChainStart(messages: RuntimeMessage[]): number {
  let index = messages.length - 1;
  while (index >= 0 && messages[index].role === "tool") {
    index -= 1;
  }
  if (index < 0) {
    return -1;
  }
  const candidate = messages[index];
  if (candidate.role === "assistant" && hasToolCalls(candidate)) {
    return index;
  }
  return -1;
}

function hasToolCalls(message: RuntimeMessage): boolean {
  const toolCalls = message.tool_calls;
  return Array.isArray(toolCalls) && toolCalls.length > 0;
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

function hasRenderableContent(content: unknown): boolean {
  if (typeof content === "string") {
    return content.trim().length > 0;
  }
  return estimateChars(content) > 0;
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
