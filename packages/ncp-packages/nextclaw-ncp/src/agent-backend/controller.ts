import type {
  NcpEndpointEvent,
  NcpMessageAbortPayload,
  NcpRequestEnvelope,
  NcpStreamRequestPayload,
} from "../types/events.types.js";

export type NcpAgentRunSendOptions = {
  signal?: AbortSignal;
};

export type NcpAgentRunStreamOptions = {
  signal?: AbortSignal;
};

export interface NcpAgentRunApi {
  send(
    envelope: NcpRequestEnvelope,
    options?: NcpAgentRunSendOptions,
  ): AsyncIterable<NcpEndpointEvent>;

  stream(
    payload: NcpStreamRequestPayload,
    options?: NcpAgentRunStreamOptions,
  ): AsyncIterable<NcpEndpointEvent>;

  abort(payload: NcpMessageAbortPayload): Promise<void>;
}

export type NcpAgentStreamProvider = {
  stream(params: {
    payload: NcpStreamRequestPayload;
    signal: AbortSignal;
  }): AsyncIterable<NcpEndpointEvent>;
};
