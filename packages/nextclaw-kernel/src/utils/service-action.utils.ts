import type {
  ServiceActionCaller,
  ServiceActionGrantState,
  ServiceActionRisk,
} from "@kernel/types/service-app.types.js";
import { ServiceAppError } from "@kernel/utils/service-app-error.utils.js";

export const DEFAULT_SERVICE_ACTION_RISK: ServiceActionRisk = "dangerous";

export function buildServiceActionId(appId: string, actionName: string): string {
  return `${appId}.${actionName}`;
}

export function getServiceActionName(actionId: string, appId: string): string {
  const prefix = `${appId}.`;
  if (!actionId.startsWith(prefix)) {
    throw new Error("service action does not belong to service app.");
  }
  const name = actionId.slice(prefix.length).trim();
  if (!name) {
    throw new Error("service action name is required.");
  }
  return name;
}

export function getServiceActionCallerKey(caller: ServiceActionCaller): string {
  return `${caller.surface}:${getServiceActionCallerId(caller)}`;
}

export function parseServiceActionCallerKey(key: string): ServiceActionCaller | null {
  const [surface, callerId, ...rest] = key.split(":");
  if (!callerId || rest.length > 0) {
    return null;
  }
  if (surface === "panel-app") return { surface, appId: callerId };
  if (surface === "agent") return { surface, agentId: callerId };
  return null;
}

export function getServiceActionCallerId(caller: ServiceActionCaller): string {
  return caller.surface === "panel-app" ? caller.appId : caller.agentId;
}

export function assertServiceActionCaller(
  caller: ServiceActionCaller,
  hasAgent?: (agentId: string) => boolean,
): void {
  if (caller.surface === "panel-app" && caller.appId.trim()) return;
  if (
    caller.surface === "agent" &&
    caller.agentId.trim() &&
    (hasAgent?.(caller.agentId) ?? true)
  ) return;
  throw new ServiceAppError("SERVICE_APP_INVALID_CALLER", "service action caller is invalid");
}

export function assertServiceActionDeclared(
  caller: ServiceActionCaller,
  actionId: string,
  declaredActions: readonly string[] | undefined,
): void {
  if (caller.surface === "agent") return;
  if (!declaredActions?.includes(actionId)) {
    throw new ServiceAppError(
      "SERVICE_APP_ACTION_NOT_DECLARED",
      "panel app did not declare this service action",
    );
  }
}

export function resolveServiceActionGrantState({
  actionId,
  declaredActions,
  granted,
}: {
  actionId: string;
  declaredActions?: readonly string[];
  granted: boolean;
}): ServiceActionGrantState {
  if (declaredActions && !declaredActions.includes(actionId)) {
    return "not-declared";
  }
  return granted ? "granted" : "not-granted";
}
