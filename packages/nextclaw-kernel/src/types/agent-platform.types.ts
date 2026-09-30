import type { NcpLLMApi, NcpTool } from "@nextclaw/ncp";
import type { AgentProfilePersistence } from "@kernel/managers/agent.manager.js";
import type { SessionPersistence } from "@kernel/types/session.types.js";
import type { SessionManagerOptions } from "@kernel/managers/session.manager.js";
import type { CompactionSummaryProvider } from "@kernel/features/context-compaction/index.js";
import type { NativeAgentRuntimeResources } from "@kernel/features/native-runtime/index.js";
import type { SessionExecutionClaims } from "@kernel/types/agent-run-host.types.js";
import type { IModelRegistry, IMcpRegistry } from "@kernel/types/kernel-capability.types.js";
import type { EventBus, Ingress } from "@nextclaw/shared";
import type { DiagnosticRuntime, SessionProjectContextResolver } from "@nextclaw/core";
import type { BootstrapContextInput, ContextRuntimeInfo } from "@kernel/contributions/context-provider/index.js";
import type { ProductActivitySink } from "@kernel/types/product-activity.types.js";

/** Platform resources contain no preassembled Agent/session/runtime managers. */
export interface AgentKernelResources {
  readonly profiles: AgentProfilePersistence;
  readonly sessions: SessionPersistence;
  readonly models: NcpLLMApi;
  readonly summaries: CompactionSummaryProvider;
  readonly modelRegistry?: IModelRegistry;
  readonly mcp?: IMcpRegistry & {
    listToolsForRun(input: { agentId: string }): readonly NcpTool[];
  };
  readonly projects: SessionManagerOptions["projectManager"];
  readonly resolveProjectContext: SessionProjectContextResolver["resolve"];
  readonly contextFiles?: Pick<BootstrapContextInput, "readText" | "readTexts">;
  readonly runtimeInfo?: ContextRuntimeInfo;
  readonly sessionSearch: SessionManagerOptions["sessionSearch"];
  readonly assets?: NativeAgentRuntimeResources["assets"];
  readonly executionClaims?: SessionExecutionClaims;
  readonly eventBus?: EventBus;
  readonly ingress?: Ingress;
  readonly diagnostics?: Pick<DiagnosticRuntime, "record">;
  readonly productActivitySink?: ProductActivitySink;
  readonly sessionTitleProvider?: SessionManagerOptions["providerManager"];
  readonly beforeDeleteSession?: SessionManagerOptions["beforeDeleteSession"];
}

export interface AgentPlatform {
  start(): Promise<AgentKernelResources>;
  dispose(): Promise<void>;
}

/** Trusted product composition. User extensions use the restricted Contribution API. */
export interface AgentKernelModule {
  attach(kernel: import("@kernel/managers/agent-kernel.manager.js").AgentKernel): void;
  start(): Promise<void>;
  ready?(): Promise<void>;
  stop?(): Promise<void>;
  dispose(): Promise<void>;
}
