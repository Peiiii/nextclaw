import type { Config } from "@nextclaw/core";
import { type DefaultNcpAgentBackend, createAgentClientFromServer } from "@nextclaw/ncp-toolkit";
import type { LocalAssetStore } from "@nextclaw/ncp-agent-runtime";
import type { NcpAgentRunApi, NcpSessionApi } from "@nextclaw/ncp";
import type { UiNcpAgent } from "@nextclaw/server";
import type { NextclawExtensionRegistry } from "../../plugins.js";
import type {
  UiNcpRuntimeRegistry,
  UiNcpSessionTypeDescribeParams,
} from "../ui-ncp-runtime-registry.js";

export type UiNcpAgentHandle = UiNcpAgent & {
  runApi: NcpAgentRunApi;
  sessionApi: NcpSessionApi;
  applyExtensionRegistry?: (extensionRegistry?: NextclawExtensionRegistry) => void;
  applyMcpConfig?: (config: Config) => Promise<void>;
  dispose?: () => Promise<void>;
};

export function createUiNcpAgentHandle(params: {
  backend: DefaultNcpAgentBackend;
  runtimeRegistry: UiNcpRuntimeRegistry;
  refreshPluginRuntimeRegistrations: () => void;
  applyExtensionRegistry: (extensionRegistry?: NextclawExtensionRegistry) => void;
  applyMcpConfig: (config: Config) => Promise<void>;
  dispose: () => Promise<void>;
  assetStore: LocalAssetStore;
}): UiNcpAgentHandle {
  const {
    backend,
    runtimeRegistry,
    refreshPluginRuntimeRegistrations,
    applyExtensionRegistry,
    applyMcpConfig,
    dispose,
    assetStore,
  } = params;
  return {
    basePath: "/api/ncp/agent",
    agentClientEndpoint: createAgentClientFromServer(backend),
    streamProvider: backend,
    runApi: backend,
    sessionApi: backend,
    listSessionTypes: (describeParams?: UiNcpSessionTypeDescribeParams) => {
      refreshPluginRuntimeRegistrations();
      return runtimeRegistry.listSessionTypes(describeParams);
    },
    assetApi: {
      put: (input) =>
        assetStore.putBytes({
          fileName: input.fileName,
          mimeType: input.mimeType,
          bytes: input.bytes,
          createdAt: input.createdAt,
        }),
      stat: (uri) => assetStore.statRecord(uri),
      resolveContentPath: (uri) => assetStore.resolveContentPath(uri),
    },
    applyExtensionRegistry,
    applyMcpConfig,
    dispose,
  };
}
