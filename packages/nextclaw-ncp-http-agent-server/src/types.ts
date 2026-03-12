import type {
  NcpAgentClientEndpoint,
  NcpEndpointEvent,
  NcpResumeRequestPayload,
} from "@nextclaw/ncp";

export const DEFAULT_BASE_PATH = "/ncp/agent";
export const DEFAULT_REQUEST_TIMEOUT_MS = 120_000;

/** Filters which events belong to the current request (session/run/correlation). */
export type EventScope = {
  sessionId: string;
  correlationId?: string;
  runId?: string;
};

/**
 * Replays stored session events for `/reconnect`.
 *
 * **Scenario**: User sends a message, agent streams SSE back. Network drops mid-stream.
 * User reconnects and requests `GET /reconnect?sessionId=xxx&remoteRunId=yyy` to
 * "continue watching the previous reply".
 *
 * **Two paths**:
 * - **Replay** (with replayProvider): Do not call agent. Fetch that run's events
 *   (message.accepted, message.text-delta, message.completed, etc.) from persistence
 *   and stream them in order. Use when you have session/event storage and want to
 *   avoid re-running the agent.
 * - **Forward** (no replayProvider): Forward `message.resume-request` to the agent
 *   and let it recover or re-run.
 *
 * **Implementation**: `stream` fetches events by payload.sessionId and payload.remoteRunId
 * from your storage and yields them in order.
 */
export type NcpHttpAgentReplayProvider = {
  stream(params: {
    payload: NcpResumeRequestPayload;
    signal: AbortSignal;
  }): AsyncIterable<NcpEndpointEvent>;
};

export type NcpHttpAgentServerOptions = {
  /** Client endpoint to forward requests to (in-process adapter or remote HTTP client). */
  agentClientEndpoint: NcpAgentClientEndpoint;
  basePath?: string;
  requestTimeoutMs?: number;
  /**
   * Optional. When set, `/reconnect` replays stored events instead of forwarding to the agent.
   * When not set, forwards `message.resume-request` to the agent.
   */
  replayProvider?: NcpHttpAgentReplayProvider;
};

export type SseEventFrame = {
  event: "ncp-event" | "error";
  data: unknown;
};
