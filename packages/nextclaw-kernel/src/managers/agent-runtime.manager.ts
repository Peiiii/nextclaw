import {
  type Config,
  type CronService,
  type GatewayController,
  getDataDir,
  type MessageBus,
  type SessionManager,
  type SessionRequestManager,
  type SessionSearchManager,
} from "@nextclaw/core";
import {
  eventKeys,
  type EventBus,
  type Ingress,
  type IngressEnvelope,
} from "@nextclaw/shared";
import type { LlmProviderRuntime } from "@kernel/managers/llm-provider.manager.js";
import { LocalAssetStore } from "@nextclaw/ncp-agent-runtime";
import {
  type NcpEndpointEvent,
  NcpEventType,
} from "@nextclaw/ncp";
import { DefaultNcpAgentBackend, type AgentSessionStore } from "@nextclaw/ncp-toolkit";
import { join } from "node:path";
import type { ExtensionManager } from "@kernel/managers/extension.manager.js";
import {
  AgentRuntimeRegistry,
  PluginRuntimeRegistrationController,
  resolveAgentRuntimeEntries,
} from "@kernel/features/runtime-registry";
import {
  createAgentRuntimeHandle,
  type AgentRuntimeHandle,
} from "@kernel/features/ncp-dispatch";
import { BuiltinNarpRuntimeRegistrationService } from "@kernel/features/narp-runtime";
import type { LlmUsageManager } from "@kernel/managers/llm-usage.manager.js";
import {
  ContextCompactionPreflightService,
  NativeAgentRuntimeFactory,
  type UpdateToolCallResult,
} from "@kernel/features/native-runtime";
import { McpRuntimeSupportOwner, type McpRuntimeSupport } from "@kernel/features/mcp-runtime-support";
import {
  AGENT_RUNTIME_SESSION_MESSAGE_INGRESS_TYPE,
  type AgentRuntimeSessionMessageRequest,
} from "@kernel/features/session-request";

export type { AgentRuntimeHandle } from "@kernel/features/ncp-dispatch";

export type AgentRuntimeManagerOptions = {
  bus: MessageBus;
  providerManager: LlmProviderRuntime;
  sessions: SessionManager;
  ingress: Ingress;
  sessionRequests: SessionRequestManager;
  sessionSearch: SessionSearchManager;
  ncpAgentSessionStore: AgentSessionStore;
  cronService?: CronService | null;
  configManager: { loadConfig: () => Config };
  extensions: ExtensionManager;
  eventBus: EventBus;
  handleNcpEvent: (event: NcpEndpointEvent) => void;
  llmUsage: LlmUsageManager;
  onSessionUpdated: (sessionKey: string) => void;
};

export class AgentRuntimeManager {
  private readonly runtimeRegistry = new AgentRuntimeRegistry();
  private readonly mcpRuntimeSupport: McpRuntimeSupport;
  private readonly assetStore = new LocalAssetStore({
    rootDir: join(getDataDir(), "assets"),
  });
  private readonly pluginRuntimeRegistrationController: PluginRuntimeRegistrationController;
  private readonly refreshConfiguredRuntimeEntries = () => {
    this.runtimeRegistry.applyEntries(
      resolveAgentRuntimeEntries({
        config: this.params.configManager.loadConfig(),
        providerKinds: this.runtimeRegistry.listProviderKinds(),
      }),
    );
  };

  private backend: DefaultNcpAgentBackend | null = null;
  private handle: AgentRuntimeHandle | null = null;
  private builtinNarpRegistrations: Array<{ dispose: () => void }> = [];
  private kernelBootstrapped = false;
  private warmupPromise: Promise<void> | null = null;
  private unsubscribeNcpEvents: (() => void) | null = null;
  private unsubscribeAgentRuntimeRequestIngress: (() => void) | null = null;
  private gatewayController: GatewayController | undefined;
  private disposed = false;

  constructor(private readonly params: AgentRuntimeManagerOptions) {
    this.mcpRuntimeSupport = new McpRuntimeSupportOwner(params.configManager.loadConfig);
    this.pluginRuntimeRegistrationController = new PluginRuntimeRegistrationController(
      this.runtimeRegistry,
      params.extensions,
    );
  }

  get currentHandle(): AgentRuntimeHandle | null {
    return this.handle;
  }

  connectGatewayController = (gatewayController: GatewayController): void => {
    this.assertNotDisposed();
    this.gatewayController = gatewayController;
  };

  bootstrap = async (): Promise<AgentRuntimeHandle> => {
    this.assertNotDisposed();
    if (this.handle) {
      return this.handle;
    }
    const nativeRuntimeFactory = new NativeAgentRuntimeFactory({
      bus: this.params.bus,
      providerManager: this.params.providerManager,
      sessions: this.params.sessions,
      sessionRequests: this.params.sessionRequests,
      sessionSearch: this.params.sessionSearch,
      cronService: this.params.cronService,
      configManager: this.params.configManager,
      extensions: this.params.extensions,
      llmUsage: this.params.llmUsage,
      onSessionUpdated: this.params.onSessionUpdated,
      resolveGatewayController: () => this.gatewayController,
      mcpToolRegistryAdapter: this.mcpRuntimeSupport.toolRegistryAdapter,
      assetStore: this.assetStore,
      updateToolCallResult: this.updateToolCallResult,
    });
    this.registerCoreRuntimes(nativeRuntimeFactory);
    const contextWindowPreview = new ContextCompactionPreflightService({
      getConfig: this.params.configManager.loadConfig,
      sessionManager: this.params.sessions,
    });

    this.backend = new DefaultNcpAgentBackend({
      endpointId: "nextclaw-ui-agent",
      sessionStore: this.params.ncpAgentSessionStore,
      onSessionRunStatusChanged: this.publishSessionRunStatus,
      resolveSessionContextWindow: ({ messages, metadata, sessionId }) =>
        contextWindowPreview.preview({
          contextWindowOwner: "nextclaw",
          requestMetadata: metadata,
          sessionId,
          sessionMessages: messages,
        }),
      createRuntime: (runtimeParams) => {
        this.pluginRuntimeRegistrationController.refreshPluginRuntimeRegistrations();
        this.refreshConfiguredRuntimeEntries();
        return this.runtimeRegistry.createRuntime({
          ...runtimeParams,
          resolveAssetContentPath: (assetUri) => this.assetStore.resolveContentPath(assetUri),
          resolveTools: nativeRuntimeFactory.resolveOpenAiToolsForRuntime,
        });
      },
    });
    this.unsubscribeAgentRuntimeRequestIngress = this.params.ingress.addHandler(
      AGENT_RUNTIME_SESSION_MESSAGE_INGRESS_TYPE,
      this.handleSessionMessageRequest,
    );
    this.unsubscribeNcpEvents = this.backend.subscribe(this.publishNcpEvent);

    await this.backend.start();
    this.handle = createAgentRuntimeHandle({
      backend: this.backend,
      runtimeRegistry: this.runtimeRegistry,
      refreshPluginRuntimeRegistrations:
        this.pluginRuntimeRegistrationController.refreshPluginRuntimeRegistrations,
      refreshConfiguredRuntimeEntries: this.refreshConfiguredRuntimeEntries,
      applyMcpConfig: this.mcpRuntimeSupport.applyMcpConfig,
      dispose: this.dispose,
      assetStore: this.assetStore,
    });
    return this.handle;
  };

  warmDerivedCapabilities = async (): Promise<void> => {
    this.assertNotDisposed();
    this.warmupPromise ??= this.runDerivedCapabilityWarmup();
    await this.warmupPromise;
  };

  dispose = async (): Promise<void> => {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    await this.warmupPromise?.catch(() => undefined);
    this.unsubscribeAgentRuntimeRequestIngress?.();
    this.unsubscribeAgentRuntimeRequestIngress = null;
    this.unsubscribeNcpEvents?.();
    this.unsubscribeNcpEvents = null;
    for (const registration of this.builtinNarpRegistrations) {
      registration.dispose();
    }
    this.pluginRuntimeRegistrationController.dispose();
    await this.backend?.stop();
    await this.mcpRuntimeSupport.dispose();
  };

  private readonly registerCoreRuntimes = (
    nativeRuntimeFactory: NativeAgentRuntimeFactory,
  ): void => {
    if (this.kernelBootstrapped) {
      return;
    }
    this.kernelBootstrapped = true;
    this.runtimeRegistry.register({
      kind: "native",
      label: "Native",
      createRuntime: nativeRuntimeFactory.create,
    });
    const builtinNarpRegistrationService = new BuiltinNarpRuntimeRegistrationService(
      this.params.configManager.loadConfig,
    );
    this.builtinNarpRegistrations = builtinNarpRegistrationService.registerInto(this.runtimeRegistry);
    this.pluginRuntimeRegistrationController.refreshPluginRuntimeRegistrations();
    this.refreshConfiguredRuntimeEntries();
  };

  private runDerivedCapabilityWarmup = async (): Promise<void> => {
    const mcpWarmResults = await this.mcpRuntimeSupport.prewarmEnabledServers();
    for (const result of mcpWarmResults) {
      if (!result.ok) {
        console.warn(`[mcp] Failed to warm ${result.name}: ${result.error}`);
      }
    }
  };

  private publishSessionRunStatus = (payload: {
    sessionKey: string;
    status: "running" | "idle";
  }): void => {
    this.params.eventBus.emit(eventKeys.sessionRunStatus, payload, {
      emittedAt: new Date().toISOString(),
      source: "backend",
    });
  };

  private publishNcpEvent = (event: NcpEndpointEvent): void => {
    this.params.eventBus.emit(eventKeys.ncpEvent, event, {
      emittedAt: new Date().toISOString(),
      source: "backend",
    });
    this.params.handleNcpEvent(event);
  };

  private handleSessionMessageRequest = async (
    envelope: IngressEnvelope<AgentRuntimeSessionMessageRequest>,
  ): Promise<void> => {
    const backend = this.backend;
    if (!backend) {
      throw new Error("NCP backend is not ready for agent runtime requests.");
    }
    const request = envelope.payload;
    if (!request?.requestId || !request.sessionId || !request.message) {
      throw new Error("Invalid agent runtime session message request.");
    }
    let terminalEventSeen = false;
    for await (const event of backend.send({
      sessionId: request.sessionId,
      message: request.message,
      correlationId: request.requestId,
    })) {
      terminalEventSeen ||= event.type === NcpEventType.MessageCompleted || event.type === NcpEventType.MessageFailed || event.type === NcpEventType.RunError;
    }
    if (!terminalEventSeen) throw new Error("Session request completed without a final reply.");
  };

  private updateToolCallResult: UpdateToolCallResult = async ({
    sessionId,
    toolCallId,
    result,
  }): Promise<void> => {
    const backend = this.backend;
    if (!backend) {
      throw new Error("NCP backend is not ready for tool result updates.");
    }
    await backend.updateToolCallResult(sessionId, toolCallId, result);
  };

  private readonly assertNotDisposed = (): void => {
    if (this.disposed) {
      throw new Error("Agent runtime has already been disposed.");
    }
  };
}
