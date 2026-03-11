import type {
  AgentEngine,
  AgentEngineDirectRequest,
  AgentEngineInboundRequest,
  Config,
  OutboundMessage,
} from "@nextclaw/core";
import type { EndpointStreamEvent } from "../types/stream.js";

export type AgentEndpointTurnInput = {
  prompt: string;
  sessionKey: string;
  channel: string;
  chatId: string;
  model: string;
  metadata: Record<string, unknown>;
  abortSignal?: AbortSignal;
};

export type AgentEndpointPrepareSessionParams = {
  sessionKey: string;
  model: string;
  metadata: Record<string, unknown>;
};

export type AbstractAgentEndpointOptions = {
  bus: unknown;
  sessionManager: unknown;
};

// Draft-only base class:
// - Keeps the intended extension points visible.
// - Deliberately avoids concrete turn orchestration for now.
export abstract class AbstractAgentEndpoint implements AgentEngine {
  abstract readonly kind: string;
  readonly supportsAbort = false;

  constructor(protected readonly options: AbstractAgentEndpointOptions) {
    void this.options;
  }

  async handleInbound(params: AgentEngineInboundRequest): Promise<OutboundMessage | null> {
    void params;
    throw new Error("NCP skeleton: handleInbound orchestration is intentionally not implemented yet");
  }

  async processDirect(params: AgentEngineDirectRequest): Promise<string> {
    void params;
    throw new Error("NCP skeleton: processDirect orchestration is intentionally not implemented yet");
  }

  applyRuntimeConfig(_config: Config): void {}

  // Endpoint-specific hooks (Codex/Claude/Platform adapters) fill these in later.
  protected abstract resolveModel(metadata: Record<string, unknown>): string;

  protected abstract executeTurn(input: AgentEndpointTurnInput): AsyncIterable<EndpointStreamEvent>;

  protected async prepareSessionState(_params: AgentEndpointPrepareSessionParams): Promise<void> {}

  protected loadRequestedSkillsContent(_requestedSkills: string[]): string {
    return "";
  }
}
