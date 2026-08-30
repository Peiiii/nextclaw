import type { AgentRunSendIngressPayload } from "@nextclaw/shared";
import type { Config } from "@nextclaw/core";
import type { AgentRunExecution } from "@kernel/services/agent-run-client.service.js";
import type { ServiceAppAiCapabilityService } from "@kernel/services/service-app-ai-capability.service.js";
import type { ServiceAppRecordService } from "@kernel/services/service-app-record.service.js";

export class ServiceAppAiManager {
  constructor(private readonly params: {
    capabilities: ServiceAppAiCapabilityService;
    records: ServiceAppRecordService;
  }) {}

  inspect = async (appId: string) => {
    const { manifest, record } = await this.params.records.require(appId);
    return await this.params.capabilities.inspect(record, manifest);
  };

  bindModel = async (appId: string, slotId: string, modelId: string) => {
    const { manifest, record } = await this.params.records.require(appId);
    return await this.params.capabilities.bindModel(record, manifest, slotId, modelId);
  };

  bindAgent = async (appId: string, slotId: string, agentId: string) => {
    const { manifest, record } = await this.params.records.require(appId);
    return await this.params.capabilities.bindAgent(record, manifest, slotId, agentId);
  };

  unbind = async (appId: string, kind: "model" | "agent", slotId: string) => {
    const { manifest, record } = await this.params.records.require(appId);
    return await this.params.capabilities.unbind(record, manifest, kind, slotId);
  };

  completeModel = async (params: {
    appId: string; slotId: string; messages: Array<Record<string, unknown>>;
    maxTokens?: number; signal?: AbortSignal;
  }) => {
    const { manifest, record } = await this.params.records.require(params.appId);
    return await this.params.capabilities.modelComplete({ ...params, app: record, manifest });
  };

  startAgent = async (params: {
    appId: string; slotId: string; input: AgentRunSendIngressPayload; callId: string;
    jobId?: string; traceId?: string; signal?: AbortSignal;
  }): Promise<AgentRunExecution> => {
    const { manifest, record } = await this.params.records.require(params.appId);
    return await this.params.capabilities.agentStart({ ...params, app: record, manifest });
  };
}

export function hasConfiguredServiceModel(config: Config, modelId: string): boolean {
  const normalized = modelId.trim();
  if (!normalized) return false;
  return new Set([
    config.agents.defaults.model,
    ...Object.keys(config.agents.defaults.models),
    ...config.agents.list.map((agent) => agent.model ?? ""),
    ...config.agents.list.flatMap((agent) => Object.keys(agent.models ?? {})),
    ...Object.values(config.providers).flatMap((provider) => provider.models ?? []),
  ].filter(Boolean)).has(normalized);
}
