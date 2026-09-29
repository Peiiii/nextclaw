import { APP_NAME, getConfigPath, getDataDir, getLogsPath, LocalExecutionClaimService, resolveSessionProjectContext } from "@nextclaw/core";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ConfigManager } from "@kernel/managers/config.manager.js";
import type { LlmProviderManager } from "@kernel/managers/llm-provider.manager.js";
import { resolveRuntimeInstanceSnapshot } from "@kernel/features/runtime-instance/utils/runtime-instance-snapshot.utils.js";
import type { AgentKernelResources } from "@kernel/types/agent-platform.types.js";
import { LocalAgentProfileStore } from "@kernel/stores/local-agent-profile.store.js";
import { ProviderManagerNcpLLMApi } from "@kernel/features/native-runtime/index.js";

type LocalResourceOwners = {
  configManager: Pick<ConfigManager, "configPath" | "applyLiveConfigReload">;
  llmProviders: LlmProviderManager;
  mcpManager: NonNullable<AgentKernelResources["mcp"]>;
  projectManager: AgentKernelResources["projects"];
  sessionSearch: AgentKernelResources["sessionSearch"];
  assetStore: AgentKernelResources["assets"];
  eventBus: AgentKernelResources["eventBus"];
  ingress: AgentKernelResources["ingress"];
  diagnostics: AgentKernelResources["diagnostics"];
};

export function createLocalContextResources(options: { configPath?: string; homeDir?: string } = {}):
  Required<Pick<AgentKernelResources, "contextFiles" | "runtimeInfo">> {
  return {
    contextFiles: { readText: (root, filename) => {
      if (filename.startsWith("memory/")) mkdirSync(resolve(root, "memory"), { recursive: true });
      const path = join(root, filename);
      return existsSync(path) ? readFileSync(path, "utf-8") : "";
    } },
    runtimeInfo: { inspect: (workspacePath) => ({
      ...resolveRuntimeInstanceSnapshot({ configPath: options.configPath ?? getConfigPath(),
        runtimeHome: options.homeDir ?? getDataDir(),
        runtimeLogsDirectory: options.homeDir ? resolve(options.homeDir, "logs") : getLogsPath(), workspacePath }),
      appName: APP_NAME, host: `${process.platform} ${process.arch}, Node ${process.version}`,
    }) },
  };
}

/** Node resource composition only; the shared AgentKernel owns the runtime graph. */
export function createLocalAgentResources(owners: LocalResourceOwners, options: {
  sessions: AgentKernelResources["sessions"];
  sessionsDir: string;
  productActivitySink?: AgentKernelResources["productActivitySink"];
  sessionTitleEnabled?: boolean;
  beforeDeleteSession?: AgentKernelResources["beforeDeleteSession"];
}): AgentKernelResources {
  return {
    profiles: new LocalAgentProfileStore({ configPath: owners.configManager.configPath,
      changed: owners.configManager.applyLiveConfigReload }),
    sessions: options.sessions,
    models: new ProviderManagerNcpLLMApi(owners.llmProviders), summaries: owners.llmProviders,
    modelRegistry: {
      registerProvider: owners.llmProviders.registerProviderPlugin,
      listProviders: owners.llmProviders.listProviderSpecs,
      chat: owners.llmProviders.chat,
      chatStream: owners.llmProviders.chatStream.bind(owners.llmProviders),
    },
    mcp: owners.mcpManager,
    projects: owners.projectManager, resolveProjectContext: resolveSessionProjectContext,
    sessionSearch: owners.sessionSearch, assets: owners.assetStore,
    eventBus: owners.eventBus, ingress: owners.ingress, diagnostics: owners.diagnostics,
    productActivitySink: options.productActivitySink,
    sessionTitleProvider: options.sessionTitleEnabled === false ? undefined : owners.llmProviders,
    beforeDeleteSession: options.beforeDeleteSession,
    executionClaims: new LocalExecutionClaimService(resolve(options.sessionsDir, ".execution-claims", "session-runs")),
  };
}
