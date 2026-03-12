import type { NcpAgentClientEndpoint } from "@nextclaw/ncp";
import type { NcpHttpAgentReplayProvider } from "./types.js";

/** Framework-agnostic HTTP handler interface for NCP agent routes. */
export interface NcpHttpAgentHandler {
  handleSend(request: Request): Promise<Response>;
  handleReconnect(request: Request): Promise<Response>;
  handleAbort(request: Request): Promise<Response>;
}

export type NcpHttpAgentHandlerOptions = {
  agentClientEndpoint: NcpAgentClientEndpoint;
  /**
   * Optional. When set, `/reconnect` replays stored events instead of forwarding to the agent.
   * See NcpHttpAgentReplayProvider for details.
   */
  replayProvider?: NcpHttpAgentReplayProvider;
  timeoutMs: number;
};
