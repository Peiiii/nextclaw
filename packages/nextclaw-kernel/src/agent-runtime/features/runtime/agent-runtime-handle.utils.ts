import type { Config } from "@nextclaw/core";
import { type DefaultNcpAgentBackend, createAgentClientFromServer } from "@nextclaw/ncp-toolkit";
import type { LocalAssetStore } from "@nextclaw/ncp-agent-runtime";
import type { NcpAgentClientEndpoint, NcpAgentRunApi, NcpSessionApi } from "@nextclaw/ncp";
import type { NcpHttpAgentStreamProvider } from "@nextclaw/ncp-http-agent-server";
import type {
  AgentRuntimeRegistry,
  AgentRuntimeSessionTypeDescribeParams,
} from "@kernel/agent-runtime/agent-runtime-registry.service.js";

type AgentRuntimeSessionTypes = Awaited<ReturnType<AgentRuntimeRegistry["listSessionTypes"]>>;

export type AgentRuntimeEndpoint = {
  agentClientEndpoint: NcpAgentClientEndpoint;
  streamProvider?: NcpHttpAgentStreamProvider;
  listSessionTypes?: (
    params?: AgentRuntimeSessionTypeDescribeParams,
  ) => Promise<AgentRuntimeSessionTypes> | AgentRuntimeSessionTypes;
  assetApi?: {
    put: (input: {
      fileName: string;
      mimeType?: string | null;
      bytes: Uint8Array;
      createdAt?: Date;
    }) => ReturnType<LocalAssetStore["putBytes"]>;
    stat: LocalAssetStore["statRecord"];
    resolveContentPath: LocalAssetStore["resolveContentPath"];
  };
  basePath?: string;
};

export type AgentRuntimeHandle = AgentRuntimeEndpoint & {
  runApi: NcpAgentRunApi;
  sessionApi: NcpSessionApi;
  applyMcpConfig?: (config: Config) => Promise<void>;
  dispose?: () => Promise<void>;
};

export function createAgentRuntimeHandle(params: {
  backend: DefaultNcpAgentBackend;
  runtimeRegistry: AgentRuntimeRegistry;
  refreshPluginRuntimeRegistrations: () => void;
  refreshConfiguredRuntimeEntries: () => void;
  applyMcpConfig: (config: Config) => Promise<void>;
  dispose: () => Promise<void>;
  assetStore: LocalAssetStore;
}): AgentRuntimeHandle {
  const {
    backend,
    runtimeRegistry,
    refreshPluginRuntimeRegistrations,
    refreshConfiguredRuntimeEntries,
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
    listSessionTypes: (describeParams?: AgentRuntimeSessionTypeDescribeParams) => {
      refreshPluginRuntimeRegistrations();
      refreshConfiguredRuntimeEntries();
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
    applyMcpConfig,
    dispose,
  };
}
