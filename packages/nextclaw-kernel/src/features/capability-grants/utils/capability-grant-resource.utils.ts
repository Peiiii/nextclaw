import type { CapabilityGrantRequest } from "@kernel/features/capability-grants/types/capability-grant.types.js";
import { createCapabilityDeclarationFingerprint } from "@kernel/features/capability-grants/utils/capability-grant.utils.js";
import type { PanelAppAgentCapability } from "@kernel/types/panel-app.types.js";
import type {
  PanelServiceActionCaller,
  ServiceAction,
  ServiceActionCaller,
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
