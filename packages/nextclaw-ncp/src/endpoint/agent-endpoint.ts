import type { NcpEndpoint } from "../types/endpoint.js";
import type { NcpEndpointManifest } from "../types/manifest.js";

/**
 * Agent-side endpoint: receives requests and emits responses.
 *
 * Extends `NcpEndpoint` with a manifest constraint (`endpointKind: "agent"`).
 * Use this on the server side that processes `message.request` / `message.resume-request`
 * and emits `message.incoming`, streaming deltas, `message.completed`, etc.
 */
export interface NcpAgentEndpoint extends NcpEndpoint {
  readonly manifest: NcpEndpointManifest & { endpointKind: "agent" };
}
