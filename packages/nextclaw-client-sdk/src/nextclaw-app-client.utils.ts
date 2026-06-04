import type { NextClawClient } from "./nextclaw-client.manager.js";

export function createNextClawAppClient(hostClient: NextClawClient) {
  return {
    sessions: {
      list: hostClient.sessions.list,
      get: hostClient.sessions.get,
      listMessages: hostClient.sessions.listMessages,
    },
    agents: {
      list: hostClient.agents.list,
      resolveAvatarUrl: hostClient.agents.resolveAvatarUrl,
    },
    agentRuns: {
      send: hostClient.agentRuns.send,
      stream: hostClient.agentRuns.stream,
      abort: hostClient.agentRuns.abort,
    },
    serviceActions: {
      list: hostClient.serviceApps.listServiceActions,
      invoke: hostClient.serviceApps.invokeServiceAction,
    },
    assets: {
      upload: hostClient.sessions.uploadAssets,
    },
    events: {
      subscribe: hostClient.realtime.subscribe,
    },
  };
}

export type NextClawAppClient = ReturnType<typeof createNextClawAppClient>;

export type NextClawPanelAppNamespace = {
  client?: NextClawAppClient;
} & Record<string, unknown>;

declare global {
  interface Window {
    nextclaw?: NextClawPanelAppNamespace;
  }
}
