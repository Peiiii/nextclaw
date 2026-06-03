import type {
  ServiceAction,
  ServiceAppManifest,
  ServiceAppRecord,
} from "@kernel/types/service-app.types.js";
import {
  buildServiceActionId,
  DEFAULT_SERVICE_ACTION_RISK,
} from "@kernel/utils/service-action.utils.js";

export function listServiceAppManifestActions(
  record: ServiceAppRecord,
  manifest: ServiceAppManifest,
): ServiceAction[] {
  if (!record.enabled) {
    return [];
  }
  return Object.entries(manifest.actions)
    .map(([name, action]) => ({
      id: buildServiceActionId(record.id, name),
      appId: record.id,
      name,
      title: action.title ?? name,
      description: action.description,
      inputSchema: action.inputSchema,
      risk: action.risk ?? DEFAULT_SERVICE_ACTION_RISK,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function mergeServiceAppRuntimeActions({
  record,
  manifest,
  runtimeActions,
}: {
  record: ServiceAppRecord;
  manifest: ServiceAppManifest;
  runtimeActions: ServiceAction[];
}): ServiceAction[] {
  const runtimeByName = new Map(runtimeActions.map((action) => [action.name, action]));
  const declared = listServiceAppManifestActions(record, manifest).map((action) => {
    const runtimeAction = runtimeByName.get(action.name);
    return {
      ...action,
      description: runtimeAction?.description ?? action.description,
      inputSchema: runtimeAction?.inputSchema ?? action.inputSchema,
      runtimeState: runtimeAction ? "matched" as const : "missing" as const,
    };
  });
  const undeclared = runtimeActions
    .filter((action) => !Object.hasOwn(manifest.actions, action.name))
    .map((action) => ({
      ...action,
      risk: DEFAULT_SERVICE_ACTION_RISK,
      runtimeState: "undeclared" as const,
    }));
  return [...declared, ...undeclared].sort((left, right) => left.id.localeCompare(right.id));
}
