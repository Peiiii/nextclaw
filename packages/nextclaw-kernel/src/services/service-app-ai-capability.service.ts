import type { AgentRunSendIngressPayload } from "@nextclaw/shared";
import type { LlmProviderRuntime } from "@kernel/managers/llm-provider.manager.js";
import type { LlmUsageManager } from "@kernel/managers/llm-usage.manager.js";
import type { AgentRunClient, AgentRunExecution } from "@kernel/services/agent-run-client.service.js";
import type { PortableServiceAppHostCall } from "@kernel/types/portable-service-app-runtime.types.js";
import { ServiceAppError } from "@kernel/utils/service-app-error.utils.js";
import type { CapabilityGrant, CapabilityGrantManager } from "@kernel/features/capability-grants/index.js";
import {
  createServiceAppAgentSlotGrantRequest,
  createServiceAppModelSlotGrantRequest,
  readServiceAppSlotTarget,
} from "@kernel/features/capability-grants/index.js";
import type {
  ServiceAppAgentCapabilitySlot,
  ServiceAppManifest,
  ServiceAppModelCapabilitySlot,
  ServiceAppRecord,
} from "@kernel/types/service-app.types.js";

export type ServiceAppAiCapabilityReadiness = {
  ready: boolean;
  requiredMissing: Array<{ kind: "model" | "agent"; slotId: string }>;
  bindings: Array<{
    kind: "model" | "agent";
    slotId: string;
    targetId: string;
    grantedAt: string;
  }>;
};

/**
 * Product authorization owner for portable Service App AI slots. It is
 * deliberately runner-agnostic: protocol 0.2 can inject these callbacks
 * without creating a second binding registry or exposing credentials.
 */
export class ServiceAppAiCapabilityService {
  constructor(private readonly params: {
    capabilityGrantManager: CapabilityGrantManager;
    hasAgent: (agentId: string) => boolean;
    hasModel: (modelId: string) => boolean;
    providerManager?: LlmProviderRuntime;
    llmUsage?: Pick<LlmUsageManager, "observeProviderManager">;
    agentRunClient?: Pick<AgentRunClient, "startRun">;
  }) {}

  inspect = async (
    app: ServiceAppRecord,
    manifest: ServiceAppManifest,
  ): Promise<ServiceAppAiCapabilityReadiness> => {
    const bindings = await this.listBindings(app, manifest);
    const bound = new Set(bindings.map((binding) => `${binding.kind}:${binding.slotId}`));
    const requiredMissing = [
      ...(manifest.requires?.modelSlots ?? [])
        .filter((slot) => slot.required && !bound.has(`model:${slot.id}`))
        .map((slot) => ({ kind: "model" as const, slotId: slot.id })),
      ...(manifest.requires?.agentSlots ?? [])
        .filter((slot) => slot.required && !bound.has(`agent:${slot.id}`))
        .map((slot) => ({ kind: "agent" as const, slotId: slot.id })),
    ];
    return { ready: requiredMissing.length === 0, requiredMissing, bindings };
  };

  assertReady = async (app: ServiceAppRecord, manifest: ServiceAppManifest): Promise<void> => {
    const readiness = await this.inspect(app, manifest);
    if (!readiness.ready) {
      const missing = readiness.requiredMissing.map(({ kind, slotId }) => `${kind}:${slotId}`).join(", ");
      throw new Error(`Required Service App AI capability slots are unbound: ${missing}.`);
    }
  };

  bindModel = async (
    app: ServiceAppRecord,
    manifest: ServiceAppManifest,
    slotId: string,
    modelId: string,
  ): Promise<ServiceAppAiCapabilityReadiness> => {
    const slot = this.requireModelSlot(manifest, slotId);
    if (!this.params.hasModel(modelId)) throw new Error(`Configured model not found: ${modelId}.`);
    await this.replaceBinding(app, "model-slot", slot.id);
    await this.params.capabilityGrantManager.grant(
      createServiceAppModelSlotGrantRequest(app, slot, modelId),
    );
    return await this.inspect(app, manifest);
  };

  bindAgent = async (
    app: ServiceAppRecord,
    manifest: ServiceAppManifest,
    slotId: string,
    agentId: string,
  ): Promise<ServiceAppAiCapabilityReadiness> => {
    const slot = this.requireAgentSlot(manifest, slotId);
    if (!this.params.hasAgent(agentId)) throw new Error(`Configured Agent not found: ${agentId}.`);
    await this.replaceBinding(app, "agent-slot", slot.id);
    await this.params.capabilityGrantManager.grant(
      createServiceAppAgentSlotGrantRequest(app, slot, agentId),
    );
    return await this.inspect(app, manifest);
  };

  unbind = async (
    app: ServiceAppRecord,
    manifest: ServiceAppManifest,
    kind: "model" | "agent",
    slotId: string,
  ): Promise<ServiceAppAiCapabilityReadiness> => {
    if (kind === "model") this.requireModelSlot(manifest, slotId);
    else this.requireAgentSlot(manifest, slotId);
    await this.replaceBinding(app, kind === "model" ? "model-slot" : "agent-slot", slotId);
    return await this.inspect(app, manifest);
  };

  modelComplete = async (params: {
    app: ServiceAppRecord;
    manifest: ServiceAppManifest;
    slotId: string;
    messages: Array<Record<string, unknown>>;
    maxTokens?: number;
    signal?: AbortSignal;
  }) => {
    const { app, manifest, slotId, messages, maxTokens, signal: parentSignal } = params;
    const slot = this.requireModelSlot(manifest, slotId);
    const modelId = await this.requireBoundModel(app, slot);
    const runtime = this.requireProviderRuntime();
    const { signal, dispose } = this.withSlotTimeout(parentSignal, slot.timeoutMs);
    try {
      return await runtime.chat({
        messages,
        model: modelId,
        maxTokens: this.clampMaxTokens(maxTokens, slot.maxTokens),
        signal,
      });
    } finally {
      dispose();
    }
  };

  agentStart = async (params: {
    app: ServiceAppRecord;
    manifest: ServiceAppManifest;
    slotId: string;
    input: AgentRunSendIngressPayload;
    callId: string;
    jobId?: string;
    traceId?: string;
    signal?: AbortSignal;
  }): Promise<AgentRunExecution> => {
    const { app, manifest, slotId, input, callId, jobId, traceId, signal } = params;
    const slot = this.requireAgentSlot(manifest, slotId);
    const agentId = await this.requireBoundAgent(app, slot);
    const client = this.params.agentRunClient;
    if (!client) throw new Error("AgentRunClient is not configured for Service App callbacks.");
    return await client.startRun({
      ...input,
      metadata: {
        ...input.metadata,
        agent_id: agentId,
        parentCorrelationId: callId,
        service_app_id: app.packageId ?? app.id,
        service_component_id: app.id,
        ...(jobId ? { service_app_job_id: jobId } : {}),
        ...(traceId ? { trace_id: traceId } : {}),
      },
    }, { abortSignal: signal });
  };

  handlePortableHostCall = async (call: PortableServiceAppHostCall): Promise<unknown> => {
    const payload = requireHostCallObject(call.request.input);
    if (call.request.capability === "model-complete") {
      const messages = payload.messages;
      if (!Array.isArray(messages) || !messages.every(isRecord)) {
        throw new ServiceAppError("SERVICE_APP_RUNTIME_FAILED", "AI model messages must be an array of objects.");
      }
      return await this.modelComplete({
        app: call.app, manifest: call.manifest,
        slotId: requireHostCallString(payload, "slotId"), messages,
        maxTokens: typeof payload.maxTokens === "number" && Number.isInteger(payload.maxTokens) ? payload.maxTokens : undefined,
        signal: call.signal,
      });
    }
    if (call.request.capability === "agent-start") {
      const input = payload.input;
      if (!isRecord(input)) throw new ServiceAppError("SERVICE_APP_RUNTIME_FAILED", "AI Agent input must be an object.");
      const execution = await this.agentStart({
        app: call.app, manifest: call.manifest,
        slotId: requireHostCallString(payload, "slotId"), input: input as AgentRunSendIngressPayload,
        callId: call.request.callId, jobId: call.request.jobId, traceId: call.request.traceId, signal: call.signal,
      });
      const completion = this.forwardPortableAgentResult(execution, call);
      call.deferTerminal?.(completion);
      return { handle: execution.handle };
    }
    throw new ServiceAppError("SERVICE_APP_RUNTIME_FAILED", `Unsupported portable host capability: ${call.request.capability}.`);
  };

  private forwardPortableAgentResult = (execution: AgentRunExecution, call: PortableServiceAppHostCall): Promise<void> => {
    const cancel = () => { void execution.cancel().catch(() => undefined); };
    const signal = call.jobSignal ?? call.signal;
    signal.addEventListener("abort", cancel, { once: true });
    return execution.result.then(
      async (result) => await call.job?.eventSink.emitChunk(JSON.stringify({
        type: "agent-result", hostCallId: call.request.hostCallId,
        handle: result.handle, text: result.text.slice(0, 8_192),
      })),
      async () => await call.job?.eventSink.emitChunk(JSON.stringify({
        type: "agent-result", hostCallId: call.request.hostCallId, status: "failed",
      })),
    ).then(() => undefined).catch(() => undefined).finally(() => {
      signal.removeEventListener("abort", cancel);
      execution.dispose();
    });
  };

  private listBindings = async (
    app: ServiceAppRecord,
    manifest: ServiceAppManifest,
  ): Promise<ServiceAppAiCapabilityReadiness["bindings"]> => {
    const declaredModels = new Map((manifest.requires?.modelSlots ?? []).map((slot) => [slot.id, slot]));
    const declaredAgents = new Map((manifest.requires?.agentSlots ?? []).map((slot) => [slot.id, slot]));
    const grants = await this.params.capabilityGrantManager.list({ subject: { type: "service-app", id: app.id } });
    const bindings: ServiceAppAiCapabilityReadiness["bindings"] = [];
    for (const grant of grants) {
      const target = readServiceAppSlotTarget(grant.resource.target);
      if (!target || target.componentId !== app.id) continue;
      if (grant.resource.type === "model-slot") {
        const slot = declaredModels.get(target.slotId);
        if (!slot || !target.modelId || !this.params.hasModel(target.modelId) || !this.matchesModelGrant(app, slot, target.modelId, grant)) continue;
        bindings.push({ kind: "model", slotId: slot.id, targetId: target.modelId, grantedAt: grant.grantedAt });
      }
      if (grant.resource.type === "agent-slot") {
        const slot = declaredAgents.get(target.slotId);
        if (!slot || !target.agentId || !this.params.hasAgent(target.agentId) || !this.matchesAgentGrant(app, slot, target.agentId, grant)) continue;
        bindings.push({ kind: "agent", slotId: slot.id, targetId: target.agentId, grantedAt: grant.grantedAt });
      }
    }
    return bindings;
  };

  private requireBoundModel = async (app: ServiceAppRecord, slot: ServiceAppModelCapabilitySlot): Promise<string> => {
    const binding = (await this.listBindings(app, { requires: { modelSlots: [slot] } } as ServiceAppManifest))
      .find((entry) => entry.kind === "model" && entry.slotId === slot.id);
    if (!binding) throw new Error(`Capability authorization is required for model slot ${slot.id}.`);
    return binding.targetId;
  };

  private requireBoundAgent = async (app: ServiceAppRecord, slot: ServiceAppAgentCapabilitySlot): Promise<string> => {
    const binding = (await this.listBindings(app, { requires: { agentSlots: [slot] } } as ServiceAppManifest))
      .find((entry) => entry.kind === "agent" && entry.slotId === slot.id);
    if (!binding) throw new Error(`Capability authorization is required for agent slot ${slot.id}.`);
    return binding.targetId;
  };

  private replaceBinding = async (
    app: ServiceAppRecord,
    resourceType: "model-slot" | "agent-slot",
    slotId: string,
  ): Promise<void> => {
    await this.params.capabilityGrantManager.revokeMatching((grant) => {
      const target = readServiceAppSlotTarget(grant.resource.target);
      return grant.subject.type === "service-app" && grant.subject.id === app.id &&
        grant.resource.type === resourceType && target?.componentId === app.id && target.slotId === slotId;
    });
  };

  private requireModelSlot = (manifest: ServiceAppManifest, slotId: string): ServiceAppModelCapabilitySlot => {
    const slot = manifest.requires?.modelSlots?.find((candidate) => candidate.id === slotId);
    if (!slot) throw new Error(`Service App did not declare model slot: ${slotId}.`);
    return slot;
  };

  private requireAgentSlot = (manifest: ServiceAppManifest, slotId: string): ServiceAppAgentCapabilitySlot => {
    const slot = manifest.requires?.agentSlots?.find((candidate) => candidate.id === slotId);
    if (!slot) throw new Error(`Service App did not declare agent slot: ${slotId}.`);
    return slot;
  };

  private matchesModelGrant = (
    app: ServiceAppRecord, slot: ServiceAppModelCapabilitySlot, modelId: string, grant: CapabilityGrant,
  ): boolean => grant.declarationFingerprint === createServiceAppModelSlotGrantRequest(app, slot, modelId).declarationFingerprint;

  private matchesAgentGrant = (
    app: ServiceAppRecord, slot: ServiceAppAgentCapabilitySlot, agentId: string, grant: CapabilityGrant,
  ): boolean => grant.declarationFingerprint === createServiceAppAgentSlotGrantRequest(app, slot, agentId).declarationFingerprint;

  private requireProviderRuntime = (): LlmProviderRuntime => {
    if (!this.params.providerManager) throw new Error("LlmProviderManager is not configured for Service App callbacks.");
    return this.params.llmUsage
      ? this.params.llmUsage.observeProviderManager(this.params.providerManager, "service-app:model-complete")
      : this.params.providerManager;
  };

  private clampMaxTokens = (requested: number | undefined, maximum: number | undefined): number | undefined => {
    if (maximum === undefined) return requested;
    return requested === undefined ? maximum : Math.min(requested, maximum);
  };

  private withSlotTimeout = (parent: AbortSignal | undefined, timeoutMs: number | undefined) => {
    if (!timeoutMs) return { signal: parent, dispose: () => undefined };
    const controller = new AbortController();
    const abort = () => controller.abort(parent?.reason);
    parent?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => controller.abort(new Error("Service App model slot timed out.")), timeoutMs);
    return {
      signal: controller.signal,
      dispose: () => {
        clearTimeout(timer);
        parent?.removeEventListener("abort", abort);
      },
    };
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireHostCallObject(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new ServiceAppError("SERVICE_APP_RUNTIME_FAILED", "Portable host call input must be an object.");
  return value;
}

function requireHostCallString(value: Record<string, unknown>, key: string): string {
  const candidate = value[key];
  if (typeof candidate !== "string" || candidate.length === 0) {
    throw new ServiceAppError("SERVICE_APP_RUNTIME_FAILED", `Portable host call ${key} must be a non-empty string.`);
  }
  return candidate;
}
