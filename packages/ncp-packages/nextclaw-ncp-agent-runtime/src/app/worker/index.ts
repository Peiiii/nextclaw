// The same runtime algorithms, without exposing a filesystem-backed asset store.
export type * from "../../index.js";
export { DefaultNcpContextBuilder } from "../../runtime/context-builder.service.js";
export { buildNcpUserContent } from "../../runtime/user-content.utils.js";
export { ncpMessageToOpenAiMessages, ncpMessageToOpenAiMessageGroups, MODEL_ROUND_PART_OFFSETS } from "../../runtime/utils/message-converter.utils.js";
export { DefaultNcpRoundBuffer } from "../../runtime/round-buffer.js";
export { DefaultNcpRoundCollector } from "../../runtime/round-collector.js";
export { executeCollectedToolCall } from "../../runtime/utils/tool-call-execution.utils.js";
export { DefaultNcpStreamEncoder } from "../../runtime/stream-encoder.service.js";
export { createNcpRuntimeStreamAttemptState, createNcpRuntimeStreamRetryEvents, getNcpRuntimeStreamRetryDelayMs,
  NCP_RUNTIME_STREAM_RETRY_INITIAL_DELAY_MS, NCP_RUNTIME_STREAM_RETRY_MAX_DELAY_MS, NCP_RUNTIME_STREAM_RETRY_METADATA_TYPE,
  observeNcpRuntimeStreamAttemptEvent, readNcpRuntimeStreamFailureReason, shouldRetryNcpRuntimeStreamAttempt } from "../../runtime/runtime-stream-recovery.utils.js";
export { DefaultNcpToolRegistry } from "../../runtime/tool-registry.manager.js";
export { EchoNcpLLMApi } from "../../runtime/llm-api-echo.js";
export { DefaultNcpAgentRuntime } from "../../runtime/agent-runtime.service.js";
export { defaultToolResultContentManager, ToolResultContentManager } from "../../tool-result/tool-result-content.manager.js";
export { assertOpenAiFunctionParametersSchema, appendToolRoundToInput, buildOpenAiFunctionTool,
  createInvalidToolArgumentsResult, createToolExecutionFailedResult, genId, getOpenAiFunctionParametersSchemaIssues,
  parseToolArgs, validateToolArgs } from "../../runtime/runtime.utils.js";
