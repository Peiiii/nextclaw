import { estimateImageBudgetTokens } from "@core/features/agent/utils/image-preparation.utils.js";

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
  fixedInputTokens: number;
  protectedPrefixMessageCount: number;
  protectedSystemContentChars: number;
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
    fixedInputTokens?: number;
    reserveTokensFloor?: number;
    softThresholdTokens?: number;
  }): InputBudgetEstimate => {
    return {
      estimatedTokens: estimateTokens(params.messages) + resolveFixedInputTokens(params.fixedInputTokens),
      budgetTokens: this.resolveBudgetTokens(params),
    };
  };

  prepareForBudget = (params: {
    messages: RuntimeMessage[];
    contextTokens?: number | null;
    fixedInputTokens?: number;
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
    fixedInputTokens?: number;
    reserveTokensFloor?: number;
    softThresholdTokens?: number;
    protectedPrefixMessageCount?: number;
    protectedSystemContentChars?: number;
  }): InputBudgetPruneResult => {
    const state = this.createPruneState(params);
    this.stabilizeProtectedPrefix(state);
    this.prepareStateForBudget(state);
    this.dropOldHistoryUntilWithinBudget(state);
    this.truncateBoundaryMessagesUntilWithinBudget(state);
    return this.toPruneResult(state);
  };

  private toPruneResult = (state: InputBudgetPruneState): InputBudgetPruneResult => {
    return {
      messages: state.work,
      estimatedTokens: estimateStateTokens(state),
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
    fixedInputTokens?: number;
    reserveTokensFloor?: number;
    softThresholdTokens?: number;
    protectedPrefixMessageCount?: number;
    protectedSystemContentChars?: number;
  }): InputBudgetPruneState => {
    const {
      messages,
      protectedPrefixMessageCount,
      protectedSystemContentChars,
    } = params;
    const contextTokens = this.resolveContextTokens(params.contextTokens);
    return {
      work: messages.map((message) => structuredClone(message)),
      contextTokens,
      budgetTokens: this.resolveBudgetTokens(params),
      fixedInputTokens: resolveFixedInputTokens(params.fixedInputTokens),
      protectedPrefixMessageCount: Math.min(
        messages.length,
        sanitizeInt(protectedPrefixMessageCount, 0) ?? 0,
      ),
      protectedSystemContentChars: sanitizeInt(protectedSystemContentChars, 0) ?? 0,
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

    for (let index = state.protectedPrefixMessageCount; index < state.work.length; index += 1) {
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
    while (estimateStateTokens(state) > state.budgetTokens) {
      const assistantIndex = state.work.findIndex((message, index) =>
        index >= state.protectedPrefixMessageCount && hasToolCalls(message),
      );
      if (assistantIndex < 0) {
        break;
      }
      this.removeAssistantToolProtocol(state, assistantIndex);
    }
  };

  private dropOldHistoryUntilWithinBudget = (state: InputBudgetPruneState): void => {
    this.pruneToolPairsUntilWithinBudget(state);
    const dropIndex = Math.max(1, state.protectedPrefixMessageCount);
    const minimumMessageCount = Math.max(2, state.protectedPrefixMessageCount + 1);
    while (estimateStateTokens(state) > state.budgetTokens && state.work.length > minimumMessageCount) {
      state.work.splice(dropIndex, 1);
      state.droppedHistoryCount += 1;
    }
    this.dropOrphanToolResults(state);
  };

  private removeAssistantToolProtocol = (state: InputBudgetPruneState, index: number): void => {
    const toolCallIds = getToolCallIds(state.work[index]);
    for (let resultIndex = state.work.length - 1; resultIndex >= 0; resultIndex -= 1) {
      if (resultIndex < state.protectedPrefixMessageCount) {
        continue;
      }
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
        if (index < state.protectedPrefixMessageCount) {
          continue;
        }
        state.work.splice(index, 1);
        state.droppedHistoryCount += 1;
        continue;
      }
      if (toolCallId) {
        toolResultIds.add(toolCallId);
      }
    }

    for (let index = state.work.length - 1; index >= 0; index -= 1) {
      if (index < state.protectedPrefixMessageCount) {
        continue;
      }
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
    while (estimateStateTokens(state) > state.budgetTokens && guard < 8) {
      guard += 1;
      if (state.protectedPrefixMessageCount === 0 && this.truncateSystemPrompt(state)) {
        continue;
      }
      if (this.truncateLastUserMessage(state)) {
        continue;
      }
      break;
    }
  };

  private stabilizeProtectedPrefix = (state: InputBudgetPruneState): void => {
    if (state.protectedPrefixMessageCount === 0) {
      return;
    }
    const dynamicInputReserveTokens = estimateTokens([
      { role: "user", content: "x".repeat(MIN_USER_KEEP_CHARS) },
    ]);
    const protectedBudgetTokens = Math.max(
      1,
      state.budgetTokens - dynamicInputReserveTokens,
    );
    let protectedTokens = estimateTokens(state.work.slice(0, state.protectedPrefixMessageCount))
      + state.fixedInputTokens;
    let guard = 0;
    while (protectedTokens > protectedBudgetTokens && guard < 8) {
      guard += 1;
      if (!this.truncateSystemPrompt(state, protectedTokens, protectedBudgetTokens)) {
        break;
      }
      protectedTokens = estimateTokens(state.work.slice(0, state.protectedPrefixMessageCount))
        + state.fixedInputTokens;
    }
  };

  private truncateSystemPrompt = (
    state: InputBudgetPruneState,
    estimatedTokens = estimateStateTokens(state),
    budgetTokens = state.budgetTokens,
  ): boolean => {
    const systemIndex = state.work.findIndex((message) => message.role === "system");
    if (systemIndex < 0) {
      return false;
    }
    const systemContent = typeof state.work[systemIndex].content === "string" ? state.work[systemIndex].content : "";
    const protectedChars = Math.min(systemContent.length, state.protectedSystemContentChars);
    const minimumKeepChars = Math.max(MIN_SYSTEM_KEEP_CHARS, protectedChars);
    if (systemContent.length <= minimumKeepChars) {
      return false;
    }
    const excessChars = Math.max(
      DEFAULT_CHARS_PER_TOKEN,
      (estimatedTokens - budgetTokens) * DEFAULT_CHARS_PER_TOKEN,
    );
    const maxChars = Math.max(
      minimumKeepChars,
      Math.min(
        Math.floor(systemContent.length * 0.8),
        systemContent.length - excessChars,
      ),
    );
    state.work[systemIndex] = {
      ...state.work[systemIndex],
      content: truncateTextAfterProtectedPrefix(systemContent, protectedChars, maxChars),
    };
    state.truncatedSystemPrompt = true;
    return true;
  };

  private truncateLastUserMessage = (state: InputBudgetPruneState): boolean => {
    const userIndex = findLastIndex(state.work, (message) => message.role === "user");
    if (userIndex < state.protectedPrefixMessageCount) {
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
  return estimateInputTokens(messages);
}

export function estimateInputTokens(value: unknown): number {
  return Math.ceil(estimateChars(value) / DEFAULT_CHARS_PER_TOKEN);
}

function estimateStateTokens(state: InputBudgetPruneState): number {
  return estimateTokens(state.work) + state.fixedInputTokens;
}

function resolveFixedInputTokens(value: unknown): number {
  return sanitizeInt(value, 0) ?? 0;
}

function estimateChars(value: unknown): number {
  const imageTokens = estimateImageContentTokens(value);
  if (imageTokens !== null) {
    return imageTokens * DEFAULT_CHARS_PER_TOKEN;
  }
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

function estimateImageContentTokens(value: unknown): number | null {
  if (typeof value === "string") {
    return isImageDataUrl(value) ? estimateImageBudgetTokens() : null;
  }
  if (!isRecord(value)) {
    return null;
  }
  const metadataSources = readImageMetadataSources(value);
  if (!metadataSources) {
    return null;
  }
  return estimateImageBudgetTokens({
    detail: readFirstValue(metadataSources, "detail"),
    height: readFirstValue(metadataSources, "height"),
    width: readFirstValue(metadataSources, "width")
  });
}

function readImageMetadataSources(value: Record<string, unknown>): Record<string, unknown>[] | null {
  const imageUrl = value.image_url ?? value.imageUrl;
  if (typeof imageUrl === "string" && isImageDataUrl(imageUrl)) {
    return [value];
  }
  if (isRecord(imageUrl) && typeof imageUrl.url === "string" && isImageDataUrl(imageUrl.url)) {
    return [imageUrl, value];
  }
  if (typeof value.url === "string" && isImageDataUrl(value.url)) {
    return [value];
  }
  if (isRawImageContent(value)) {
    return [value];
  }
  return null;
}

function isRawImageContent(value: Record<string, unknown>): boolean {
  return (
    value.type === "image" &&
    typeof value.data === "string" &&
    value.data.length > 0 &&
    typeof value.mimeType === "string" &&
    value.mimeType.startsWith("image/")
  );
}

function readFirstValue(sources: Record<string, unknown>[], key: string): unknown {
  for (const source of sources) {
    const value = source[key];
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isImageDataUrl(value: string): boolean {
  return /^data:image\/[^,]+;base64,/i.test(value);
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

function truncateTextAfterProtectedPrefix(text: string, protectedChars: number, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  const prefix = text.slice(0, protectedChars);
  const suffixBudget = Math.max(0, maxChars - prefix.length);
  if (suffixBudget === 0) {
    return prefix;
  }
  const suffix = text.slice(protectedChars);
  if (suffixBudget <= CONTEXT_TRUNCATION_SUFFIX.length + 16) {
    return `${prefix}${suffix.slice(0, suffixBudget)}`;
  }
  const keep = suffixBudget - CONTEXT_TRUNCATION_SUFFIX.length;
  return `${prefix}${suffix.slice(0, keep).trimEnd()}${CONTEXT_TRUNCATION_SUFFIX}`;
}

function findLastIndex<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) {
      return index;
    }
  }
  return -1;
}
