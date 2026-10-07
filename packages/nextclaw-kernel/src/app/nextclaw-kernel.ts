import { createKernelResourceProviders } from "@kernel/utils/catalog-resource-providers.utils.js";
import type { NodePlatform } from "@kernel/features/node-platform/index.js";
import { AccessManager } from "@kernel/managers/access.manager.js";
import type { AutomationManager } from "@kernel/managers/automation.manager.js";
import { AppPackageManager } from "@kernel/managers/app-package.manager.js";
import type { AppDataManager } from "@kernel/managers/app-data.manager.js";
import type { ChannelManager } from "@kernel/managers/channel.manager.js";
import type { ConfigManager } from "@kernel/managers/config.manager.js";
import { ExtensionManager } from "@kernel/managers/extension.manager.js";
import type { LlmProviderManager } from "@kernel/managers/llm-provider.manager.js";
import type { ProviderModelCatalogManager } from "@kernel/managers/provider-model-catalog.manager.js";
import type { LlmUsageManager } from "@kernel/managers/llm-usage.manager.js";
import { AgentRunClient } from "@kernel/services/agent-run-client.service.js";
import type { VerificationRecordService } from "@kernel/services/verification-record.service.js";
import { InboxDeliveryManager } from "@kernel/managers/inbox-delivery.manager.js";
import {
  SystemObjectReferenceManager,
} from "@kernel/managers/system-object-reference.manager.js";
import type { McpManager } from "@kernel/managers/mcp.manager.js";
import { SessionContextCompactionManager } from "@kernel/managers/session-context-compaction.manager.js";
import { PanelAppManager } from "@kernel/managers/panel-app.manager.js";
import type { PlannedRestartRecoveryManager } from "@kernel/managers/planned-restart-recovery.manager.js";
import { PreferenceManager } from "@kernel/managers/preference.manager.js";
import type { ProjectManager, ProjectMaterialService, ProjectWorkManager } from "@kernel/features/projects/index.js";
import type { ServiceAppManager } from "@kernel/managers/service-app.manager.js";
import { SkillManager } from "@kernel/managers/skill.manager.js";
import type { AgentRuntimeSessionTypeDescribeParams } from "@kernel/features/runtime-registry/index.js";
import { ObservationManager } from "@kernel/features/observation/index.js";
import type { AgentKernel } from "@kernel/managers/agent-kernel.manager.js";
import type { IKernel } from "@kernel/types/kernel-capability.types.js";
import {
  CapabilityGrantLegacyMigrationService,
  CapabilityGrantManager,
} from "@kernel/features/capability-grants/index.js";
import {
  UnavailableDesktopHost,
  type DesktopHost,
} from "@kernel/features/desktop-host/index.js";
import { FeatureControlsService } from "@kernel/features/feature-controls/index.js";
import type { KernelContribution } from "@kernel/types/kernel-contribution.types.js";
import type { LocalAssetStore } from "@nextclaw/ncp-agent-runtime";
import {
  type GatewayController,
  getWorkspacePath,
  type MessageBus,
  type ExecRunner,
  type DiagnosticRuntime,
  type SessionSearchService,
} from "@nextclaw/core";
import type { EventBus, Ingress } from "@nextclaw/shared";
import {
  resolveKernelAppHomeDirectory,
  resolveKernelCapabilityGrantMigrationMarkerPath,
  resolveKernelCapabilityGrantStorePath,
  resolveKernelInboxDeliveryStorePath,
  resolveKernelObservationStorePath,
  resolveKernelVerificationRecordStorePath,
  resolveKernelPreferenceStorePath,
  resolveKernelPlannedRestartRecoveryPath,
} from "@kernel/app/kernel-storage-paths.js";
import {
  createKernelContributions,
  createKernelPlannedRestartRecovery,
  createKernelAppRuntimeManagers,
  createPortableRuntimeAcceptanceServices,
} from "@kernel/app/kernel-manager.factory.js";
import type { ProductActivitySink } from "@kernel/types/product-activity.types.js";
import type { PortableRuntimeAcceptanceManager } from "@kernel/services/portable-runtime-acceptance-manager.service.js";

export type NextclawKernelOptions = {
  homeDir?: string;
  configPath?: string;
  builtInAppsDirectory?: string;
  portableServiceRunnerPath?: string;
  productVersion?: string;
  /** Version of the active runtime bundle; local development falls back to productVersion. */
  runtimeVersion?: string;
  productActivitySink?: ProductActivitySink;
  desktopHost?: DesktopHost;
  contextProfile?: "default" | "embedded";
  sessionSearchEnabled?: boolean;
  sessionTitleEnabled?: boolean;
  /** Host-owned command execution. The local product uses the ordinary process runner by default. */
  execRunner?: ExecRunner;
};

type NextclawKernelRuntimeControl<TGatewayInput, TUiInput, TStartInput> = {
  gateway: (input: TGatewayInput) => Promise<void>;
  ui: (input: TUiInput) => Promise<void>;
  start: (input: TStartInput) => Promise<void>;
  restart: (input: TStartInput) => Promise<void>;
  serve: (input: TStartInput) => Promise<void>;
  stop: () => Promise<void>;
};

class NextclawKernelControlManager<TGatewayInput, TUiInput, TStartInput> {
  private runtimeControl: NextclawKernelRuntimeControl<
    TGatewayInput,
    TUiInput,
    TStartInput
  > | null = null;

  installRuntimeControl = (
    runtimeControl: NextclawKernelRuntimeControl<
      TGatewayInput,
      TUiInput,
      TStartInput
    >,
  ) => {
    this.runtimeControl = runtimeControl;
  };

  requireRuntimeControl = () => {
    if (!this.runtimeControl) {
      throw new Error("Kernel runtime control is not installed.");
    }
    return this.runtimeControl;
  };
}
export class NextclawKernel {
  readonly capabilities: IKernel;
  readonly eventBus: EventBus;
  readonly ingress: Ingress;
  readonly messageBus: MessageBus;
  readonly diagnostics: DiagnosticRuntime;
  readonly llmProviders: LlmProviderManager;
  readonly providerModelCatalog: ProviderModelCatalogManager;
  readonly llmUsage: LlmUsageManager;
  readonly configManager: ConfigManager;
  readonly accessManager: AccessManager;
  readonly agents: AgentKernel["agents"];
  readonly control: NextclawKernelControlManager<unknown, unknown, unknown>;
  readonly skills: SkillManager;
  readonly automation: AutomationManager;
  readonly appPackageManager: AppPackageManager;
  readonly appDataManager: AppDataManager;
  readonly channels: ChannelManager;
  readonly sessionRequests: AgentKernel["sessionRequests"];
  readonly sessionSearch: SessionSearchService;
  readonly assetStore: LocalAssetStore;
  readonly mcpManager: McpManager;
  readonly sessionManager: AgentKernel["sessionManager"];
  readonly userQuestions: AgentKernel["userQuestions"];
  readonly inboxDeliveryManager: InboxDeliveryManager;
  readonly systemObjectReferenceManager: SystemObjectReferenceManager;
  readonly panelAppManager: PanelAppManager;
  readonly preferenceManager: PreferenceManager;
  readonly projectManager: ProjectManager;
  readonly projectMaterials: ProjectMaterialService;
  readonly projectWorkManager: ProjectWorkManager;
  readonly serviceAppManager: ServiceAppManager;
  readonly extensions: ExtensionManager;
  readonly agentRuntimeManager: AgentKernel["agentRuntimeManager"];
  readonly agentContextWindowManager: AgentKernel["agentContextWindowManager"];
  readonly contextCompactionManager: AgentKernel["contextCompactionManager"];
  readonly contextProviderManager: AgentKernel["contextProviderManager"];
  readonly requestContextTailManager: AgentKernel["requestContextTailManager"];
  readonly sessionRunManager: AgentKernel["sessionRunManager"];
  readonly sessionContextCompactionManager: SessionContextCompactionManager;
  readonly toolProviderManager: AgentKernel["toolProviderManager"];
  readonly agentRunRequestManager: AgentKernel["agentRunRequestManager"];
  readonly observations: ObservationManager;
  readonly capabilityGrants: CapabilityGrantManager;
  readonly featureControls: FeatureControlsService;
  readonly verificationRecords: VerificationRecordService;
  readonly portableRuntimeAcceptance: PortableRuntimeAcceptanceManager;
  readonly plannedRestartRecovery: PlannedRestartRecoveryManager;
  private readonly capabilityGrantLegacyMigration: CapabilityGrantLegacyMigrationService;
  private readonly contributions: KernelContribution[];
  private gatewayController: GatewayController | undefined;
  get execRunner(): NextclawKernelOptions["execRunner"] { return this.options.execRunner; }
  constructor(agentKernel: AgentKernel, platform: NodePlatform, private readonly options: NextclawKernelOptions = {}) {
    ({ eventBus: this.eventBus, ingress: this.ingress, messageBus: this.messageBus,
      diagnostics: this.diagnostics, llmProviders: this.llmProviders,
      providerModelCatalog: this.providerModelCatalog, llmUsage: this.llmUsage,
      automation: this.automation, channels: this.channels, configManager: this.configManager,
      assetStore: this.assetStore, projectManager: this.projectManager,
      projectMaterials: this.projectMaterials, projectWorkManager: this.projectWorkManager,
      sessionSearch: this.sessionSearch, mcpManager: this.mcpManager } = platform.local);
    const desktopHost = options.desktopHost ?? new UnavailableDesktopHost();
    this.capabilityGrants = new CapabilityGrantManager(resolveKernelCapabilityGrantStorePath(options));
    ({ verificationRecords: this.verificationRecords, portableRuntimeAcceptance: this.portableRuntimeAcceptance } =
      createPortableRuntimeAcceptanceServices({ ...options, verificationRecordStorePath: resolveKernelVerificationRecordStorePath(options) }));
    this.featureControls = new FeatureControlsService(desktopHost);
    this.control = new NextclawKernelControlManager<unknown, unknown, unknown>();
    this.accessManager = new AccessManager({ configManager: this.configManager, homeDir: options.homeDir });
    this.capabilityGrantLegacyMigration = this.createCapabilityGrantLegacyMigration(options);
    ({
      capabilities: this.capabilities, agents: this.agents,
      agentContextWindowManager: this.agentContextWindowManager,
      contextProviderManager: this.contextProviderManager,
      toolProviderManager: this.toolProviderManager,
      requestContextTailManager: this.requestContextTailManager,
      agentRuntimeManager: this.agentRuntimeManager,
      contextCompactionManager: this.contextCompactionManager,
      sessionManager: this.sessionManager, sessionRunManager: this.sessionRunManager,
      agentRunRequestManager: this.agentRunRequestManager, userQuestions: this.userQuestions,
      sessionRequests: this.sessionRequests,
    } = agentKernel);
    this.observations = new ObservationManager({
      storePath: resolveKernelObservationStorePath(options), sessionManager: this.sessionManager,
      agentManager: this.agents, ingress: this.ingress, eventBus: this.eventBus,
    });
    this.inboxDeliveryManager = new InboxDeliveryManager({
      eventBus: this.eventBus,
      storePath: resolveKernelInboxDeliveryStorePath(options),
    });
    this.appPackageManager = new AppPackageManager({
      appHomeDirectory: resolveKernelAppHomeDirectory(options),
      builtInAppsDirectory: options.builtInAppsDirectory,
      productVersion: options.productVersion,
      getSecretConfig: () => this.configManager.config,
      secretConfigPath: this.configManager.configPath,
    });
    this.panelAppManager = new PanelAppManager({
      configManager: this.configManager,
      eventBus: this.eventBus,
      ingress: this.ingress,
      listPackageComponentSources: this.appPackageManager.listActiveComponentSources,
      listPackageComponentDiagnostics: async () =>
        (await this.appPackageManager.listActiveComponentSourcesWithDiagnostics()).unavailablePackages,
      resolvePackagePrimaryPanelId: this.appPackageManager.resolvePrimaryPanelId,
      capabilityGrantManager: this.capabilityGrants,
    });
    this.preferenceManager = new PreferenceManager({
      storePath: resolveKernelPreferenceStorePath(options),
    });
    ({ appDataManager: this.appDataManager, serviceAppManager: this.serviceAppManager } = createKernelAppRuntimeManagers({
      appHomeDirectory: resolveKernelAppHomeDirectory(options),
      appPackageManager: this.appPackageManager,
      panelAppManager: this.panelAppManager,
      configManager: this.configManager,
      capabilityGrantManager: this.capabilityGrants,
      hasAgent: (agentId) => this.agents.getAgent(agentId) !== null,
      providerManager: this.llmProviders,
      llmUsage: this.llmUsage,
      agentRunClient: new AgentRunClient({ eventBus: this.eventBus, ingress: this.ingress }),
      portableServiceRunnerPath: options.portableServiceRunnerPath,
      verificationRecords: this.verificationRecords,
    }));
    this.extensions = new ExtensionManager({
      capabilityGrantManager: this.capabilityGrants,
      desktopHost,
      hasAgent: (agentId) => this.agents.getAgent(agentId) !== null,
      diagnostics: this.diagnostics,
      configManager: this.configManager,
      eventBus: this.eventBus,
      ingress: this.ingress,
      messageBus: this.messageBus,
      sessionManager: this.sessionManager,
      observations: this.observations,
    });
    this.skills = new SkillManager({
      workspace: getWorkspacePath(this.configManager.config.agents.defaults.workspace),
    });
    this.systemObjectReferenceManager = new SystemObjectReferenceManager(this.assetStore, createKernelResourceProviders(this));
    this.configManager.installRuntimeHooks({
      resolveChannelConfig: this.extensions.toConfigView,
      getExtensionChannels: () =>
        this.extensions.getExtensionRegistry().channels,
      reloadExtensions: async ({ config, changedPaths }) => {
        await this.extensions.reloadForConfigChange({
          config,
          changedPaths,
        });
      },
      reloadMcp: async ({ config }) =>
        await this.mcpManager.applyConfig(config),
    });
    this.sessionContextCompactionManager = new SessionContextCompactionManager(
      this.agentRuntimeManager,
      this.eventBus,
      this.sessionManager,
      this.sessionRunManager,
    );
    this.plannedRestartRecovery = createKernelPlannedRestartRecovery(
      this, resolveKernelPlannedRestartRecoveryPath(options),
    );
    this.contributions = createKernelContributions(this, options.contextProfile);
  }

  private createCapabilityGrantLegacyMigration = (options: NextclawKernelOptions) =>
    new CapabilityGrantLegacyMigrationService({
      capabilityGrantManager: this.capabilityGrants,
      markerPath: resolveKernelCapabilityGrantMigrationMarkerPath(options),
      validateGrant: async (grant) =>
        await this.panelAppManager.matchesCapabilityGrant(grant) ||
        await this.serviceAppManager.matchesCapabilityGrant(grant),
      workspacePath: getWorkspacePath(this.configManager.config.agents.defaults.workspace),
    });

  listSessionTypes = (params?: AgentRuntimeSessionTypeDescribeParams) =>
    this.agentRuntimeManager.listSessionTypes(params);

  isSessionRunning = (sessionId: string): boolean =>
    this.sessionRunManager.isSessionRunning(sessionId);

  provideGatewayController = (gatewayController: GatewayController): void => {
    this.gatewayController = gatewayController;
  };

  getGatewayController = (): GatewayController | undefined =>
    this.gatewayController;

  start = async (): Promise<void> => {
    await this.capabilityGrantLegacyMigration.migrate();
    await this.appPackageManager.start();
    await this.appDataManager.start();
    await this.serviceAppManager.start();
    this.providerModelCatalog.start();
    for (const contribution of this.contributions) await contribution.start();
  };

  ready = async (): Promise<void> => { await this.observations.start(); };

  stop = async (): Promise<void> => {
    const errors: unknown[] = [];
    for (const dispose of [this.observations.dispose, this.extensions.dispose,
      ...[...this.contributions].reverse().map((contribution) => () => contribution.dispose())]) {
      try { await dispose(); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, "Local product shutdown failed.");
  };

  dispose = async (): Promise<void> => { await this.serviceAppManager.dispose(); };
}
