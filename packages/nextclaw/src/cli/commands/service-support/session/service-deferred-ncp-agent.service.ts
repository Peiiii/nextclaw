import type { UiNcpAgent } from "@nextclaw/server";
import type { NcpAgentClientEndpoint } from "@nextclaw/ncp";
import type { UiNcpAgentHandle } from "../../ncp/features/runtime/create-ui-ncp-agent.service.js";

const DEFAULT_BASE_PATH = "/api/ncp/agent";
const DEFERRED_NCP_AGENT_UNAVAILABLE = "ncp agent unavailable during startup";

function createUnavailableError(): Error {
  return new Error(DEFERRED_NCP_AGENT_UNAVAILABLE);
}

export type DeferredUiNcpAgentController = {
  agent: UiNcpAgent;
  activate: (agent: UiNcpAgentHandle) => void;
  clear: () => void;
  close: () => Promise<void>;
  isReady: () => boolean;
};

class DeferredUiNcpAgentControllerOwner implements DeferredUiNcpAgentController {
  agent: UiNcpAgent;
  private activeAgent: UiNcpAgentHandle | null = null;

  private readonly endpoint: NcpAgentClientEndpoint = {
    manifest: {
      endpointKind: "agent",
      endpointId: "nextclaw-ui-agent-deferred",
      version: "0.0.0",
      supportsStreaming: true,
      supportsAbort: true,
      supportsProactiveMessages: false,
      supportsLiveSessionStream: true,
      supportedPartTypes: ["text"],
      expectedLatency: "seconds",
      metadata: {
        deferred: true,
      },
    },
    start: async () => {
      await this.activeAgent?.agentClientEndpoint.start();
    },
    stop: async () => {
      await this.activeAgent?.agentClientEndpoint.stop();
    },
    emit: async (event) => {
      if (!this.activeAgent) {
        throw createUnavailableError();
      }
      await this.activeAgent.agentClientEndpoint.emit(event);
    },
    subscribe: (listener) => {
      if (!this.activeAgent) {
        return () => undefined;
      }
      return this.activeAgent.agentClientEndpoint.subscribe(listener);
    },
    send: async (envelope) => {
      if (!this.activeAgent) {
        throw createUnavailableError();
      }
      await this.activeAgent.agentClientEndpoint.send(envelope);
    },
    stream: async (payload) => {
      if (!this.activeAgent) {
        throw createUnavailableError();
      }
      await this.activeAgent.agentClientEndpoint.stream(payload);
    },
    abort: async (payload) => {
      if (!this.activeAgent) {
        throw createUnavailableError();
      }
      await this.activeAgent.agentClientEndpoint.abort(payload);
    },
  };

  constructor(private readonly basePath: string) {
    this.agent = {
      basePath,
      agentClientEndpoint: this.endpoint,
    };
  }

  activate = (nextAgent: UiNcpAgentHandle): void => {
    this.activeAgent = nextAgent;
    this.agent.basePath = nextAgent.basePath ?? this.basePath;
    this.agent.streamProvider = nextAgent.streamProvider;
    this.agent.listSessionTypes = nextAgent.listSessionTypes;
    this.agent.assetApi = nextAgent.assetApi;
  };

  clear = (): void => {
    this.activeAgent = null;
    this.agent.basePath = this.basePath;
    this.agent.streamProvider = undefined;
    this.agent.listSessionTypes = undefined;
    this.agent.assetApi = undefined;
  };

  close = async (): Promise<void> => {
    const current = this.activeAgent;
    this.clear();
    await current?.agentClientEndpoint.stop();
    await current?.dispose?.();
  };

  isReady = (): boolean => {
    return this.activeAgent !== null;
  };
}

export function createDeferredUiNcpAgent(basePath = DEFAULT_BASE_PATH): DeferredUiNcpAgentController {
  return new DeferredUiNcpAgentControllerOwner(basePath);
}
