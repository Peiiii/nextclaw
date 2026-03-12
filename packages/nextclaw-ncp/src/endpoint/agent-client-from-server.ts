import type {
  NcpMessageAbortPayload,
  NcpRequestEnvelope,
  NcpResumeRequestPayload,
} from "../types/events.js";
import type { NcpAgentClientEndpoint } from "./agent-client-endpoint.js";
import type { NcpAgentServerEndpoint } from "./agent-server-endpoint.js";

/**
 * Creates an NcpAgentClientEndpoint that forwards to an in-process NcpAgentServerEndpoint.
 * Use when the agent runs in-process and you need to pass a client endpoint to the HTTP server.
 */
export function createAgentClientFromServer(
  server: NcpAgentServerEndpoint,
): NcpAgentClientEndpoint {
  return {
    ...server,
    async send(envelope: NcpRequestEnvelope): Promise<void> {
      await server.emit({ type: "message.request", payload: envelope });
    },
    async resume(payload: NcpResumeRequestPayload): Promise<void> {
      await server.emit({ type: "message.resume-request", payload });
    },
    async abort(payload?: NcpMessageAbortPayload): Promise<void> {
      await server.emit({ type: "message.abort", payload: payload ?? {} });
    },
  };
}
