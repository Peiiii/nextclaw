import type {
  NcpEndpointEvent,
  NcpMessageAbortPayload,
  NcpRequestEnvelope,
  NcpStreamRequestPayload,
} from "../types/events.types.js";
import type { NcpEndpoint } from "../types/endpoint.types.js";
import type { NcpEndpointManifest } from "../types/manifest.js";

/**
 * Agent server-side endpoint: receives requests and produces downstream events.
 *
 * Extends `NcpEndpoint` with a manifest constraint (`endpointKind: "agent"`).
 * Use this on the server side that handles send/stream/abort requests and emits
 * downstream events (`message.incoming`, streaming deltas, `message.completed`, etc.).
 */
export interface NcpAgentServerEndpoint extends NcpEndpoint {
  readonly manifest: NcpEndpointManifest & { endpointKind: "agent" };

  /** Handles a new message request from client side and yields produced events. */
  send(
    envelope: NcpRequestEnvelope,
    options?: { signal?: AbortSignal },
  ): AsyncIterable<NcpEndpointEvent>;

  /** Streams live events for an active session and yields produced events. */
  stream(
    payload: NcpStreamRequestPayload,
    options?: { signal?: AbortSignal },
  ): AsyncIterable<NcpEndpointEvent>;

  /** Aborts the active execution of a session on server side. */
  abort(payload: NcpMessageAbortPayload): Promise<void>;

  /**
   * Publishes server-downstream events (typically sent to frontend subscribers/transports).
   * For handling client requests, prefer `send` / `stream` / `abort`.
   */
  emit(event: NcpEndpointEvent): Promise<void>;
}
