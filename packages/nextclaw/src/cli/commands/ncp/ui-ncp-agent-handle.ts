import type { Config } from "@nextclaw/core";
import { type DefaultNcpAgentBackend, createAgentClientFromServer } from "@nextclaw/ncp-toolkit";
import type { LocalAssetStore } from "@nextclaw/ncp-agent-runtime";
import type { NcpSessionApi } from "@nextclaw/ncp";
import type { UiNcpAgent } from "@nextclaw/server";
import type { NextclawExtensionRegistry } from "../plugins.js";
import type {
  UiNcpRuntimeRegistry,
  UiNcpSessionTypeDescribeParams,
} from "./ui-ncp-runtime-registry.js";

export type UiNcpAgentHandle = UiNcpAgent & {
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
  return {
    basePath: "/api/ncp/agent",
    agentClientEndpoint: createAgentClientFromServer(params.backend),
    streamProvider: params.backend,
    sessionApi: params.backend,
    listSessionTypes: (describeParams?: UiNcpSessionTypeDescribeParams) => {
      params.refreshPluginRuntimeRegistrations();
      return params.runtimeRegistry.listSessionTypes(describeParams);
    },
    assetApi: {
      put: (input) =>
        params.assetStore.putBytes({
          fileName: input.fileName,
          mimeType: input.mimeType,
          bytes: input.bytes,
          createdAt: input.createdAt,
        }),
      stat: (uri) => params.assetStore.statRecord(uri),
      resolveContentPath: (uri) => params.assetStore.resolveContentPath(uri),
    },
    applyExtensionRegistry: params.applyExtensionRegistry,
    applyMcpConfig: params.applyMcpConfig,
    dispose: params.dispose,
  };
}
