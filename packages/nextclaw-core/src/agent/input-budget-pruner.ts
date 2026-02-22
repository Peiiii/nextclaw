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

export type InputBudgetPruneResult = {
  messages: RuntimeMessage[];
  estimatedTokens: number;
  budgetTokens: number;
  droppedHistoryCount: number;
  truncatedToolResultCount: number;
  truncatedSystemPrompt: boolean;
  truncatedUserMessage: boolean;
};

export class InputBudgetPruner {
  prune(params: {
    messages: RuntimeMessage[];
    contextTokens?: number | null;
    reserveTokensFloor?: number;
    softThresholdTokens?: number;
  }): InputBudgetPruneResult {
    const contextTokens = sanitizePositiveInt(params.contextTokens) ?? DEFAULT_CONTEXT_TOKENS;
    const reserveTokens = sanitizeNonNegativeInt(params.reserveTokensFloor) ?? DEFAULT_RESERVE_TOKENS_FLOOR;
    const softThreshold = sanitizeNonNegativeInt(params.softThresholdTokens) ?? DEFAULT_SOFT_THRESHOLD_TOKENS;
    const budgetTokens = Math.max(1, contextTokens - reserveTokens - softThreshold);

    const work = params.messages.map(cloneMessage);
    const maxToolResultChars = Math.min(
      HARD_MAX_TOOL_RESULT_CHARS,
      Math.max(2_000, Math.floor(contextTokens * MAX_TOOL_RESULT_CONTEXT_SHARE * DEFAULT_CHARS_PER_TOKEN))
    );

    let truncatedToolResultCount = 0;
    for (let index = 0; index < work.length; index += 1) {
      const message = work[index];
      if (message.role !== "tool") {
        continue;
      }
      const content = typeof message.content === "string" ? message.content : "";
      if (!content || content.length <= maxToolResultChars) {
        continue;
      }
      work[index] = {
        ...message,
        content: truncateText(content, maxToolResultChars, TOOL_RESULT_TRUNCATION_SUFFIX)
      };
      truncatedToolResultCount += 1;
    }

    let droppedHistoryCount = 0;
    while (estimateTokens(work) > budgetTokens && work.length > 2) {
      work.splice(1, 1);
      droppedHistoryCount += 1;
    }

    let truncatedSystemPrompt = false;
    let truncatedUserMessage = false;
    let guard = 0;
    while (estimateTokens(work) > budgetTokens && guard < 8) {
      guard += 1;

      const systemIndex = work.findIndex((message) => message.role === "system");
      if (systemIndex >= 0) {
        const systemContent = typeof work[systemIndex].content === "string" ? work[systemIndex].content : "";
        if (systemContent.length > MIN_SYSTEM_KEEP_CHARS) {
          work[systemIndex] = {
            ...work[systemIndex],
            content: truncateText(systemContent, Math.max(MIN_SYSTEM_KEEP_CHARS, Math.floor(systemContent.length * 0.8)))
          };
          truncatedSystemPrompt = true;
          continue;
        }
      }

      const userIndex = findLastIndex(work, (message) => message.role === "user");
      if (userIndex >= 0) {
        const userContent = typeof work[userIndex].content === "string" ? work[userIndex].content : "";
        if (userContent.length > MIN_USER_KEEP_CHARS) {
          work[userIndex] = {
            ...work[userIndex],
            content: truncateText(userContent, Math.max(MIN_USER_KEEP_CHARS, Math.floor(userContent.length * 0.8)))
          };
          truncatedUserMessage = true;
          continue;
        }
      }

      break;
    }

    return {
      messages: work,
      estimatedTokens: estimateTokens(work),
      budgetTokens,
      droppedHistoryCount,
      truncatedToolResultCount,
      truncatedSystemPrompt,
      truncatedUserMessage
    };
  }
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
