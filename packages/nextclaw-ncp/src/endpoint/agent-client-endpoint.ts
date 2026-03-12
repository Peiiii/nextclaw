import type {
  NcpMessageAbortPayload,
  NcpRequestEnvelope,
  NcpResumeRequestPayload,
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
  send(envelope: NcpRequestEnvelope): Promise<void>;

  /** Resumes an existing run by remote run id. Emits `message.resume-request`. */
  resume(payload: NcpResumeRequestPayload): Promise<void>;

  /** Aborts the current or specified run. Emits `message.abort`. */
  abort(payload?: NcpMessageAbortPayload): Promise<void>;
}
