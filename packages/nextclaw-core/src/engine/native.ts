import { AgentLoop } from "../agent/loop.js";
import type { Config } from "../config/schema.js";
import type { AgentEngine, AgentEngineDirectRequest, AgentEngineInboundRequest } from "./types.js";

type AgentLoopOptions = ConstructorParameters<typeof AgentLoop>[0];

export class NativeAgentEngine implements AgentEngine {
  readonly kind = "native";

  private loop: AgentLoop;

  constructor(options: AgentLoopOptions) {
    this.loop = new AgentLoop(options);
  }

  handleInbound(params: AgentEngineInboundRequest) {
    return this.loop.handleInbound(params);
  }

  processDirect(params: AgentEngineDirectRequest) {
    return this.loop.processDirect(params);
  }

  applyRuntimeConfig(config: Config): void {
    this.loop.applyRuntimeConfig(config);
  }
}
