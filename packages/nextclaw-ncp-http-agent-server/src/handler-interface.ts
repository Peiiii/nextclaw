import type { NcpAgentServerEndpoint } from "@nextclaw/ncp";
import type { NcpHttpAgentReplayProvider } from "./types.js";

export interface NcpHttpAgentHandler {
  handleSend(request: Request): Promise<Response>;
  handleReconnect(request: Request): Promise<Response>;
  handleAbort(request: Request): Promise<Response>;
}

export type NcpHttpAgentHandlerOptions = {
  agentEndpoint: NcpAgentServerEndpoint;
  replayProvider?: NcpHttpAgentReplayProvider;
  timeoutMs: number;
};
