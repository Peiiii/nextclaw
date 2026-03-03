import type { SessionEvent } from "../session/manager.js";
import type { Config } from "../config/schema.js";
import type { InboundMessage, OutboundMessage } from "../bus/events.js";
import type { MessageBus } from "../bus/queue.js";
import type { ProviderManager } from "../providers/provider_manager.js";
import type { SessionManager } from "../session/manager.js";
import type { CronService } from "../cron/service.js";
import type { GatewayController } from "../agent/tools/gateway.js";
import type { ExtensionRegistry } from "../extensions/types.js";

export type AssistantDeltaHandler = (delta: string) => void;
export type SessionEventHandler = (event: SessionEvent) => void;

export type AgentEngineDirectRequest = {
  content: string;
  sessionKey?: string;
  channel?: string;
  chatId?: string;
  metadata?: Record<string, unknown>;
  onAssistantDelta?: AssistantDeltaHandler;
  onSessionEvent?: SessionEventHandler;
};

export type AgentEngineInboundRequest = {
  message: InboundMessage;
  sessionKey?: string;
  publishResponse?: boolean;
};

export type AgentEngineMessageToolHintsResolver = (params: {
  sessionKey: string;
  channel: string;
  chatId: string;
  accountId?: string | null;
}) => string[];

export type AgentEngineFactoryContext = {
  agentId: string;
  workspace: string;
  model: string;
  maxIterations: number;
  contextTokens: number;
  engineConfig?: Record<string, unknown>;
  bus: MessageBus;
  providerManager: ProviderManager;
  sessionManager: SessionManager;
  cronService?: CronService | null;
  restrictToWorkspace: boolean;
  braveApiKey?: string;
  execConfig: { timeout: number };
  contextConfig: Config["agents"]["context"];
  gatewayController?: GatewayController;
  config: Config;
  extensionRegistry?: ExtensionRegistry;
  resolveMessageToolHints?: AgentEngineMessageToolHintsResolver;
};

export type AgentEngineFactory = (context: AgentEngineFactoryContext) => AgentEngine;

export interface AgentEngine {
  readonly kind: string;
  handleInbound(params: AgentEngineInboundRequest): Promise<OutboundMessage | null>;
  processDirect(params: AgentEngineDirectRequest): Promise<string>;
  applyRuntimeConfig(config: Config): void;
}
