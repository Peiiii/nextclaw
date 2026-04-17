import type {
  NcpEndpointEvent,
  NcpMessage,
  NcpMessagePart,
  NcpRequestEnvelope,
} from "@nextclaw/ncp";

export type HermesHttpAdapterFetchLike = (
  input: URL | string | Request,
  init?: RequestInit,
) => Promise<Response>;

export type HermesHttpAdapterConfig = {
  host: string;
  port: number;
  basePath: string;
  hermesBaseUrl: string;
  hermesApiKey?: string;
  model: string;
  systemPrompt?: string;
  streamWaitTimeoutMs: number;
  healthcheckTimeoutMs: number;
  fetchImpl?: HermesHttpAdapterFetchLike;
};

export type HermesHttpAdapterResolvedConfig = HermesHttpAdapterConfig & {
  chatCompletionsUrl: string;
  healthcheckUrl: string;
};

export type HermesHttpAdapterRun = {
  envelope: NcpRequestEnvelope;
  messageId: string;
  runId: string;
};

export type HermesHttpAdapterRunResult = {
  events: AsyncIterable<NcpEndpointEvent>;
};

export type HermesOpenAIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type HermesAdapterAssistantMessageParams = {
  sessionId: string;
  messageId: string;
  parts: NcpMessagePart[];
  timestamp: string;
  metadata?: Record<string, unknown>;
};

export type HermesAdapterAssistantMessageFactory = (
  params: HermesAdapterAssistantMessageParams,
) => NcpMessage;
