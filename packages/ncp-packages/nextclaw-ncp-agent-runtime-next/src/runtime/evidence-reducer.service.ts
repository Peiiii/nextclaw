import type { NcpToolCallResult } from "@nextclaw/ncp";

const VERIFICATION_PROMPT = `You are a strict verifier reviewing a tool execution result for accuracy.

Analyze the tool result below and report:
1. Whether the result appears internally consistent (no contradictions, no obvious hallucinations)
2. Whether the key facts/claims are self-contained and verifiable
3. A brief verdict: PASS or NEEDS_REVIEW

Rules:
- If the result is empty, short (< 100 chars), or clearly an error message → PASS
- If the result contains structured data (JSON, tables, lists) → verify internal consistency
- If the result is free-form text with factual claims → check for self-consistency only, do NOT validate against external knowledge
- NEVER modify the original result; only append a verification note

Output format:
VERDICT: PASS | NEEDS_REVIEW
NOTE: <one-line reason>`;

/**
 * Evidence-Preserving Reducer：
 * 对超出阈值的大工具结果进行轻量预审，生成验证摘要附加到结果中，
 * 防止后续 LLM 收到未经核实的原始大输出时误传播错误信息。
 *
 * 机制：
 * 1. 工具执行完成后，如果结果字节数 > thresholdChars 且 enabled=true
 * 2. 将原始结果截取前 MAX_PREVIEW_CHARS 作为预览，连同 VERIFICATION_PROMPT 构造审核请求
 * 3. 用小模型（或同模型 but 极短上下文）生成 VERDICT + NOTE
 * 4. 将审核结果注入到工具结果 content 中，保持原始数据可追溯
 */
export class EvidencePreservingReducer {
  private readonly thresholdChars: number;
  private readonly injectSummary: boolean;
  private readonly maxPreviewChars: number;
  private readonly maxReviewChars: number;

  constructor(options: {
    thresholdChars?: number;
    injectSummary?: boolean;
    maxPreviewChars?: number;
    maxReviewChars?: number;
  } = {}) {
    this.thresholdChars = options.thresholdChars ?? 4_096;
    this.injectSummary = options.injectSummary ?? true;
    this.maxPreviewChars = options.maxPreviewChars ?? 2_048;
    this.maxReviewChars = options.maxReviewChars ?? 256;
  }

  shouldReduce = (resultBytes: number): boolean => {
    return resultBytes > this.thresholdChars;
  };

  reduceResult = (toolCallResult: NcpToolCallResult): NcpToolCallResult => {
    const serialized = estimateBytes(toolCallResult.result);
    if (!this.shouldReduce(serialized)) {
      return toolCallResult;
    }

    // 截取预览用于审核
    const preview = serializeForReview(toolCallResult.result, this.maxPreviewChars);
    const reviewPrompt = buildReviewPrompt(preview);

    return {
      ...toolCallResult,
      result: this.injectSummary
        ? {
            _reducerReview: reviewPrompt,
            _originalSize: serialized,
            _verdict: null as string | null,
            _note: null as string | null,
          }
        : toolCallResult.result,
    };
  };

  /** 设置审核结果（由调用方在获取小模型响应后调用）。 */
  applyVerdict = (
    toolCallResult: NcpToolCallResult,
    verdict: string,
    note: string,
  ): NcpToolCallResult => {
    const r = toolCallResult.result;
    if (!isReviewEnvelope(r) || !r._originalSize) {
      return toolCallResult;
    }
    return {
      ...toolCallResult,
      result: {
        ...r,
        _verdict: verdict,
        _note: truncateMiddle(note, this.maxReviewChars),
      },
    };
  };
}

function isReviewEnvelope(
  value: unknown,
): value is { _reducerReview?: string; _originalSize?: number; _verdict?: string | null; _note?: string | null } {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "_reducerReview" in value
  );
}

function buildReviewPrompt(preview: string): string {
  return `${VERIFICATION_PROMPT}\n\n---\nTool result preview (first ${preview.length} chars):\n${preview}`;
}

function estimateBytes(value: unknown): number {
  if (typeof value === "string") return value.length * 2;
  try {
    return JSON.stringify(value ?? null).length * 2;
  } catch {
    return 0;
  }
}

function serializeForReview(value: unknown, maxChars: number): string {
  if (typeof value === "string") {
    return value.length <= maxChars ? value : `${value.slice(0, maxChars)}… [truncated]`;
  }
  try {
    const s = JSON.stringify(value ?? null);
    return s.length <= maxChars ? s : `${s.slice(0, maxChars)}… [truncated]`;
  } catch {
    return "[unserializable]";
  }
}

function truncateMiddle(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  const marker = "\n… [truncated] …";
  if (maxChars <= marker.length) return value.slice(0, maxChars);
  const keep = maxChars - marker.length;
  const head = Math.ceil(keep / 2);
  const tail = Math.floor(keep / 2);
  return `${value.slice(0, head)}${marker}${value.slice(value.length - tail)}`;
}
