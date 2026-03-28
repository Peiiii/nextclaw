import type { UiNcpAgent } from "@nextclaw/server";
import type { NcpAgentClientEndpoint } from "@nextclaw/ncp";
import type { UiNcpAgentHandle } from "./ncp/create-ui-ncp-agent.js";

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

export function createDeferredUiNcpAgent(basePath = DEFAULT_BASE_PATH): DeferredUiNcpAgentController {
  let activeAgent: UiNcpAgentHandle | null = null;

  const endpoint: NcpAgentClientEndpoint = {
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
    async start() {
      await activeAgent?.agentClientEndpoint.start();
    },
    async stop() {
      await activeAgent?.agentClientEndpoint.stop();
    },
    async emit(event) {
      if (!activeAgent) {
        throw createUnavailableError();
      }
      await activeAgent.agentClientEndpoint.emit(event);
    },
    subscribe(listener) {
      if (!activeAgent) {
        return () => undefined;
      }
      return activeAgent.agentClientEndpoint.subscribe(listener);
    },
    async send(envelope) {
      if (!activeAgent) {
        throw createUnavailableError();
      }
      await activeAgent.agentClientEndpoint.send(envelope);
    },
    async stream(payload) {
      if (!activeAgent) {
        throw createUnavailableError();
      }
      await activeAgent.agentClientEndpoint.stream(payload);
    },
    async abort(payload) {
      if (!activeAgent) {
        throw createUnavailableError();
      }
      await activeAgent.agentClientEndpoint.abort(payload);
    },
  };

  const agent: UiNcpAgent = {
    basePath,
    agentClientEndpoint: endpoint,
  };

  const clear = () => {
    activeAgent = null;
    agent.basePath = basePath;
    agent.streamProvider = undefined;
    agent.listSessionTypes = undefined;
    agent.assetApi = undefined;
  };

  return {
    agent,
    activate(nextAgent) {
      activeAgent = nextAgent;
      agent.basePath = nextAgent.basePath ?? basePath;
      agent.streamProvider = nextAgent.streamProvider;
      agent.listSessionTypes = nextAgent.listSessionTypes;
      agent.assetApi = nextAgent.assetApi;
    },
    clear,
    async close() {
      const current = activeAgent;
      clear();
      await current?.agentClientEndpoint.stop();
    },
    isReady() {
      return activeAgent !== null;
    },
  };
}
