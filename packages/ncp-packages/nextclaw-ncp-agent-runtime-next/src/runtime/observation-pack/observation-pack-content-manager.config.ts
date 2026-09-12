import type { NcpToolCallResult } from "@nextclaw/ncp";
import type { ToolResultContentManager } from "@nextclaw/ncp-agent-runtime";
import type { ObservationStore } from "./observation-pack-store.config.js";
import type { NcpLLMApiInput, OpenAIChatMessage } from "@nextclaw/ncp";

const DEFAULT_OBSERVATION_THRESHOLD_CHARS = 8_000;

export type ObservationPackOptions = {
  /** 底层 content manager（通常取 defaultToolResultContentManager）。 */
  delegate: ToolResultContentManager;
  /** observation store，管理归档条目。 */
  store: ObservationStore;
  /** 结果字节数超过此阈值时触发归档（默认 8000）。 */
  thresholdChars?: number;
};

/**
 * ObservationPack 包装器：
 * 1. 委托给底层 content manager 做正常归一化。
 * 2. 归一化后检查原始 result 字节数；若超过阈值则将完整结果归档。
 * 3. 若归档发生，把 toolCallResult.result 替换为简短 handle，
 *    避免大输出占用上下文预算。
 */
export class ObservationPackToolResultContentManager {
  private readonly delegate: ToolResultContentManager;
  private readonly store: ObservationStore;
  private readonly thresholdChars: number;

  constructor(options: ObservationPackOptions) {
    const { delegate, store, thresholdChars } = options;
    this.delegate = delegate;
    this.store = store;
    this.thresholdChars =
      typeof thresholdChars === "number" && thresholdChars > 0
        ? thresholdChars
        : DEFAULT_OBSERVATION_THRESHOLD_CHARS;
  }

  normalizeToolCallResult = (toolCallResult: NcpToolCallResult): NcpToolCallResult => {
    const originalSerializedBytes = estimateBytes(toolCallResult.result);
    const normalized = this.delegate.normalizeToolCallResult(toolCallResult);

    if (originalSerializedBytes <= this.thresholdChars) {
      return normalized;
    }

    // 归档完整结果，返回 handle
    const observationId = this.store.store(normalized.result, originalSerializedBytes);
    return {
      ...normalized,
      result: `[observation: ${observationId}]`,
    };
  };

  compactInput = (input: NcpLLMApiInput): NcpLLMApiInput =>
    this.delegate.compactInput(input);

  toModelContent = (result: unknown, context?: { toolCallId?: string; toolName?: string }): string =>
    this.delegate.toModelContent(result, context);

  toVisualObservationMessages = (
    toolResults: ReadonlyArray<NcpToolCallResult>,
  ): OpenAIChatMessage[] =>
    this.delegate.toVisualObservationMessages(toolResults);
}

function estimateBytes(value: unknown): number {
  if (typeof value === "string") return value.length * 2; // UTF-16 approx
  try {
    return JSON.stringify(value ?? null).length * 2;
  } catch {
    return 0;
  }
}
