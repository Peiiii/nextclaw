export type RunTrace = { runId: string; sessionId?: string };
type DiagnosticFields = RunTrace & {
  stage?: string; status?: number; errorCode?: string; durationMs?: number;
  requestBytes?: number; messageCount?: number; toolCount?: number;
  snapshotBytes?: number; persisted?: boolean; runtimeId?: string;
  compactionStatus?: string; phase?: string;
  errorType?: string; errorLocation?: string;
};

export function readTrace(headers: Headers): RunTrace {
  const validId = (value: string | null) => value && /^[a-zA-Z0-9_-]{1,100}$/.test(value) ? value : undefined;
  return { runId: validId(headers.get("x-bibo-run-id")) ?? crypto.randomUUID(),
    sessionId: validId(headers.get("x-bibo-session-id")) };
}

export function traceHeaders(trace: RunTrace): Record<string, string> {
  return { "x-bibo-run-id": trace.runId, ...(trace.sessionId ? { "x-bibo-session-id": trace.sessionId } : {}) };
}

/** Only explicit scalar fields may leave the process: never serialize errors or request bodies. */
export function logDiagnostic(component: "worker" | "container" | "model", event: string, fields: DiagnosticFields, level: "info" | "warn" | "error" = "info"): void {
  const record = {
    schema: "bibo.diagnostic/v1", timestamp: new Date().toISOString(), level, component, event,
    runId: fields.runId, sessionId: fields.sessionId, stage: fields.stage, status: fields.status,
    errorCode: fields.errorCode, durationMs: fields.durationMs, requestBytes: fields.requestBytes,
    messageCount: fields.messageCount, toolCount: fields.toolCount, snapshotBytes: fields.snapshotBytes,
    persisted: fields.persisted, runtimeId: fields.runtimeId, compactionStatus: fields.compactionStatus, phase: fields.phase,
    errorType: fields.errorType, errorLocation: fields.errorLocation,
  };
  console[level](JSON.stringify(record));
}

export function errorDetails(error: unknown): { errorType?: string; errorLocation?: string } {
  if (!(error instanceof Error)) return {};
  const code = (error as Error & { code?: unknown }).code;
  return {
    errorType: typeof code === "string" && /^[A-Z_]{2,50}$/.test(code) ? code : /^[A-Za-z]{1,50}$/.test(error.name) ? error.name : "Error",
    // Preserve code locations, not the message or absolute paths containing personal data.
    errorLocation: error.stack?.split("\n").slice(1).map((line) => line.match(/([a-zA-Z0-9_.-]+\.[cm]?[jt]s:\d+:\d+)/)?.[1]).filter(Boolean).slice(0, 4).join(" "),
  };
}

export class BiboRunError extends Error {
  constructor(readonly code: string, readonly status: number, message: string) { super(message); }
}

export function runFailure(error: unknown, aborted = false): BiboRunError {
  if (error instanceof BiboRunError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (aborted || (error instanceof Error && error.name === "AbortError")) return new BiboRunError("RUN_CANCELLED", 409, "本次生成已停止或超时，本轮未保存。");
  if (/\b413\b|模型输入过长/.test(message)) return new BiboRunError("MODEL_INPUT_TOO_LARGE", 413, "本次模型请求超过传输上限，本轮未保存。重复发送相同内容无法解决，请联系维护者。");
  if (/\b429\b|今日试用额度/.test(message)) return new BiboRunError("MODEL_RATE_LIMITED", 429, "模型服务达到用量或频率限制，请稍后再试。");
  if (/context compaction/i.test(message)) return new BiboRunError("CONTEXT_COMPACTION_FAILED", 502, "上下文整理未能完成，本轮未保存，请稍后重试。");
  if (/Chat Completions API failed/.test(message)) return new BiboRunError("MODEL_REQUEST_FAILED", 502, "模型服务未能完成请求，本轮未保存，请稍后重试。");
  return new BiboRunError("RUN_FAILED", 503, "Bibo 暂时无法完成这次任务，请稍后重试。");
}

export function readRunFailure(value: unknown): BiboRunError {
  const body = value as { code?: unknown; status?: unknown } | null;
  const failures: Record<string, BiboRunError> = {
    MODEL_INPUT_TOO_LARGE: runFailure(new Error("413")), MODEL_RATE_LIMITED: runFailure(new Error("429")),
    CONTEXT_COMPACTION_FAILED: runFailure(new Error("Context compaction")),
    MODEL_REQUEST_FAILED: runFailure(new Error("Chat Completions API failed")), RUN_CANCELLED: runFailure(null, true),
    RUN_TIMEOUT: new BiboRunError("RUN_TIMEOUT", 504, "本次生成超时，本轮未保存，请稍后重试。"),
  };
  return typeof body?.code === "string" && failures[body.code] ? failures[body.code] : runFailure(null);
}

// Transport protection, not a context window. Kernel owns token budgeting and compaction.
export const MAX_MODEL_REQUEST_BYTES = 16 * 1024 * 1024;
export async function readModelRequest(request: Request): Promise<{ raw: string; bytes: number }> {
  if (Number(request.headers.get("content-length")) > MAX_MODEL_REQUEST_BYTES) throw runFailure(new Error("413"));
  const reader = request.body?.getReader();
  if (!reader) return { raw: "", bytes: 0 };
  const decoder = new TextDecoder();
  let raw = "";
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_MODEL_REQUEST_BYTES) { await reader.cancel(); throw runFailure(new Error("413")); }
      raw += decoder.decode(value, { stream: true });
    }
    return { raw: raw + decoder.decode(), bytes };
  } finally { reader.releaseLock(); }
}
