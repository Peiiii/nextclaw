import type {
  NcpMessageAbortPayload,
  NcpAgentSendEnvelope,
  NcpStreamRequestPayload,
} from "../types/events.js";
import type { NcpEndpoint } from "../types/endpoint.js";

/**
 * Client-side endpoint for agent chat: initiates requests and can cancel in-flight runs.
 *
 * Extends `NcpEndpoint` with role-specific methods. Use this on the caller side
 * (e.g. frontend, CLI) that sends user messages and receives agent responses.
 */
export interface NcpAgentClientEndpoint extends NcpEndpoint {
  /** Sends a new message request to the agent. Emits `message.request`. */
  send(envelope: NcpAgentSendEnvelope): Promise<void>;

  /** Attaches to the live event stream of a session. Emits `message.stream-request`. */
  stream(payload: NcpStreamRequestPayload): Promise<void>;

  /** Aborts the active execution of a session. Emits `message.abort`. */
  abort(payload: NcpMessageAbortPayload): Promise<void>;
}
