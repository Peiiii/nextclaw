import type {
  ServiceActionCaller,
  ServiceActionGrantState,
  ServiceActionRisk,
} from "@kernel/types/service-app.types.js";

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
  return `${caller.surface}:${caller.appId}`;
}

export function parseServiceActionCallerKey(key: string): ServiceActionCaller | null {
  const [surface, appId, ...rest] = key.split(":");
  if (surface !== "panel-app" || !appId || rest.length > 0) {
    return null;
  }
  return { surface, appId };
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
