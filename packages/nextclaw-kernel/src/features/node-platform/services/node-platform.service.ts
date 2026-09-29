import { resolve } from "node:path";
import { DiagnosticRuntime, expandHome, getDataDir, MessageBus } from "@nextclaw/core";
import { EventBus, Ingress } from "@nextclaw/shared";
import { LocalAssetStore } from "@nextclaw/ncp-agent-runtime";
import type { AgentKernelResources, AgentPlatform } from "@kernel/types/agent-platform.types.js";
import { createLocalAgentResources, createLocalContextResources } from "@kernel/app/local-agent-resources.factory.js";
import { resolveKernelLegacyProjectStorePath, resolveKernelProjectDatabasePath, resolveKernelSessionsDir } from "@kernel/app/kernel-storage-paths.js";
import { LlmProviderManager } from "@kernel/managers/llm-provider.manager.js";
import { LlmUsageManager } from "@kernel/managers/llm-usage.manager.js";
import { ProviderModelCatalogManager } from "@kernel/managers/provider-model-catalog.manager.js";
import { McpManager } from "@kernel/managers/mcp.manager.js";
import { createKernelOperationalManagers, createKernelSessionResources } from "@kernel/app/kernel-manager.factory.js";
import { resolveKernelAutomationStorePath } from "@kernel/app/kernel-storage-paths.js";

export type NodePlatformOptions = {
  homeDir?: string;
  configPath?: string;
  sessionSearchEnabled?: boolean;
  sessionTitleEnabled?: boolean;
  productActivitySink?: AgentKernelResources["productActivitySink"];
  beforeDeleteSession?: AgentKernelResources["beforeDeleteSession"];
};

type OpenedResources = { resources: AgentKernelResources; dispose(): Promise<void> };

/** Opens native resources. Agent, session and run managers are created only by AgentKernel. */
export class NodePlatform implements AgentPlatform {
  private opening: Promise<OpenedResources> | undefined;
  private closing: Promise<void> | undefined;
  private owners: ReturnType<NodePlatform["createOwners"]> | undefined;

  constructor(private readonly options: NodePlatformOptions = {}) {}

  get local(): ReturnType<NodePlatform["createOwners"]> {
    if (!this.owners) throw new Error("Node platform resources are not open.");
    return this.owners;
  }

  start = async (): Promise<AgentKernelResources> => {
    if (this.closing) await this.closing;
    this.opening ??= this.open().catch((error) => { this.opening = undefined; throw error; });
    return (await this.opening).resources;
  };

  dispose = async (): Promise<void> => {
    if (this.closing) return this.closing;
    const opening = this.opening;
    this.opening = undefined;
    if (!opening) return;
    this.closing = opening.then((opened) => opened.dispose(), () => undefined)
      .finally(() => { this.closing = undefined; this.owners = undefined; });
    return this.closing;
  };

  private createOwners = () => {
    const homeDir = resolve(expandHome(this.options.homeDir ?? getDataDir()));
    const configPath = this.options.configPath ?? (this.options.homeDir ? resolve(homeDir, "config.json") : undefined);
    const eventBus = new EventBus();
    const ingress = new Ingress();
    const diagnostics = new DiagnosticRuntime();
    const messageBus = new MessageBus();
    const llmProviders = new LlmProviderManager();
    const providerModelCatalog = new ProviderModelCatalogManager(llmProviders);
    const operational = createKernelOperationalManagers({ configPath, diagnostics, messageBus,
      providerManager: llmProviders, providerModelCatalogManager: providerModelCatalog,
      automationStorePath: resolveKernelAutomationStorePath({ homeDir }) });
    const mcpManager = new McpManager(operational.configManager.loadConfig);
    const sessionsDir = resolveKernelSessionsDir({ homeDir });
    const sessions = createKernelSessionResources({ kernel: { configManager: operational.configManager, eventBus },
      projectDatabasePath: resolveKernelProjectDatabasePath({ homeDir }),
      legacyProjectStorePath: resolveKernelLegacyProjectStorePath({ homeDir }),
      sessionsDir, homeDir });
    return { homeDir, sessionsDir, eventBus, ingress, diagnostics, messageBus, llmProviders,
      providerModelCatalog, llmUsage: new LlmUsageManager(), mcpManager,
      assetStore: new LocalAssetStore({ rootDir: resolve(homeDir, "assets") }), ...operational, ...sessions };
  };

  private open = async (): Promise<OpenedResources> => {
    const owners = this.createOwners();
    const { homeDir, sessionsDir, configManager, journalStore, projectManager, projectWorkManager, sessionSearch, mcpManager } = owners;
    const dispose = async (): Promise<void> => {
      owners.providerModelCatalog.dispose();
      const settled = await Promise.allSettled([mcpManager.dispose(), sessionSearch.dispose(),
        Promise.resolve().then(() => projectWorkManager.dispose()),
        Promise.resolve().then(() => projectManager.dispose())]);
      const errors = settled.flatMap((result) => result.status === "rejected" ? [result.reason] : []);
      if (errors.length) throw new AggregateError(errors, "Node platform resource cleanup failed.");
    };
    try {
      await journalStore.initialize();
      await projectManager.initialize();
      await projectWorkManager.initialize();
      if (this.options.sessionSearchEnabled !== false) void sessionSearch.start();
      mcpManager.start();
      configManager.installRuntimeHooks({ reloadMcp: async ({ config }) => await mcpManager.applyConfig(config) });
      const resources = createLocalAgentResources(owners, { sessions: journalStore, sessionsDir,
        productActivitySink: this.options.productActivitySink, beforeDeleteSession: this.options.beforeDeleteSession,
        sessionTitleEnabled: this.options.sessionTitleEnabled });
      this.owners = owners;
      return { resources: { ...resources, ...createLocalContextResources({ homeDir, configPath: configManager.configPath }) }, dispose };
    } catch (error) {
      await dispose().catch(() => undefined);
      throw error;
    }
  };
}
