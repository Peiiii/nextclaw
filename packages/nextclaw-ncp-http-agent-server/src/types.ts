import type {
  NcpAgentServerEndpoint,
  NcpEndpointEvent,
  NcpResumeRequestPayload,
} from "@nextclaw/ncp";

export const DEFAULT_BASE_PATH = "/ncp/agent";
export const DEFAULT_REQUEST_TIMEOUT_MS = 120_000;

export type EventScope = {
  sessionId: string;
  correlationId?: string;
  runId?: string;
};

export type NcpHttpAgentReplayProvider = {
  stream(params: {
    payload: NcpResumeRequestPayload;
    signal: AbortSignal;
  }): AsyncIterable<NcpEndpointEvent>;
};

export type NcpHttpAgentServerOptions = {
  agentEndpoint: NcpAgentServerEndpoint;
  basePath?: string;
  requestTimeoutMs?: number;
  replayProvider?: NcpHttpAgentReplayProvider;
};

export type SseEventFrame = {
  event: "ncp-event" | "error";
  data: unknown;
};
