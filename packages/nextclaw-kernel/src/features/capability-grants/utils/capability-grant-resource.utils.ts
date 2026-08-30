import type { CapabilityGrantRequest } from "@kernel/features/capability-grants/types/capability-grant.types.js";
import { createCapabilityDeclarationFingerprint } from "@kernel/features/capability-grants/utils/capability-grant.utils.js";
import type { PanelAppAgentCapability } from "@kernel/types/panel-app.types.js";
import type {
  PanelServiceActionCaller,
  ServiceAction,
  ServiceActionCaller,
  ServiceAppAgentCapabilitySlot,
  ServiceAppModelCapabilitySlot,
  ServiceAppRecord,
} from "@kernel/types/service-app.types.js";
import { getServiceActionCallerId } from "@kernel/utils/service-action.utils.js";

export function createPanelAppClientGrantRequest(
  appId: string,
): CapabilityGrantRequest {
  return {
    subject: { type: "panel-app", id: appId },
    resource: { type: "nextclaw.client", target: { appId } },
    access: ["connect"],
    declarationFingerprint: createCapabilityDeclarationFingerprint({ client: true }),
  };
}

export function createPanelAppAgentGrantRequest(
  caller: PanelServiceActionCaller,
  capability: PanelAppAgentCapability,
): CapabilityGrantRequest {
  return {
    subject: { type: caller.surface, id: getServiceActionCallerId(caller) },
    resource: { type: "agent.capability", target: { capability } },
    access: ["invoke"],
    declarationFingerprint: createCapabilityDeclarationFingerprint({ capability }),
  };
}

export function createServiceActionGrantRequest(
  caller: ServiceActionCaller,
  action: ServiceAction,
): CapabilityGrantRequest {
  return {
    subject: { type: caller.surface, id: getServiceActionCallerId(caller) },
    resource: { type: "service.action", target: { actionId: action.id } },
    access: ["invoke"],
    declarationFingerprint: createCapabilityDeclarationFingerprint({
      id: action.id,
      risk: action.risk,
    }),
  };
}

export function readServiceActionTargetId(target: unknown): string | null {
  if (!target || typeof target !== "object" || Array.isArray(target)) return null;
  const actionId = (target as { actionId?: unknown }).actionId;
  return typeof actionId === "string" ? actionId : null;
}

export function createServiceAppModelSlotGrantRequest(
  app: ServiceAppRecord,
  slot: ServiceAppModelCapabilitySlot,
  modelId: string,
): CapabilityGrantRequest {
  return createServiceAppSlotGrantRequest(app, "model-slot", slot, { modelId });
}

export function createServiceAppAgentSlotGrantRequest(
  app: ServiceAppRecord,
  slot: ServiceAppAgentCapabilitySlot,
  agentId: string,
): CapabilityGrantRequest {
  return createServiceAppSlotGrantRequest(app, "agent-slot", slot, { agentId });
}

function createServiceAppSlotGrantRequest(
  app: ServiceAppRecord,
  resourceType: "model-slot" | "agent-slot",
  slot: ServiceAppModelCapabilitySlot | ServiceAppAgentCapabilitySlot,
  binding: { modelId: string } | { agentId: string },
): CapabilityGrantRequest {
  return {
    subject: { type: "service-app", id: app.id },
    resource: {
      type: resourceType,
      target: { componentId: app.id, slotId: slot.id, ...binding },
    },
    access: ["invoke"],
    declarationFingerprint: createCapabilityDeclarationFingerprint({
      resourceType,
      slot,
    }),
  };
}

export function readServiceAppSlotTarget(target: unknown): {
  componentId: string;
  slotId: string;
  modelId?: string;
  agentId?: string;
} | null {
  if (!target || typeof target !== "object" || Array.isArray(target)) return null;
  const value = target as Record<string, unknown>;
  if (typeof value.componentId !== "string" || typeof value.slotId !== "string") return null;
  const modelId = typeof value.modelId === "string" ? value.modelId : undefined;
  const agentId = typeof value.agentId === "string" ? value.agentId : undefined;
  return modelId || agentId
    ? { componentId: value.componentId, slotId: value.slotId, modelId, agentId }
    : null;
}
