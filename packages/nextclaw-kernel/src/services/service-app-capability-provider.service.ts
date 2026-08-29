import type { CapabilityProviderView } from "@kernel/types/app-package.types.js";
import type { ServiceAppManifest, ServiceAppRecord } from "@kernel/types/service-app.types.js";

export function projectCapabilityProviders(
  entries: Array<{ manifest: ServiceAppManifest; record: ServiceAppRecord }>,
): CapabilityProviderView[] {
  return entries.flatMap(({ manifest, record }) => {
    if (manifest.lifecycle?.mode !== "provider" || !record.enabled || record.status !== "running") return [];
    const capabilities = manifest.provides?.capabilities ?? [];
    return capabilities.length === 0 ? [] : [{
      providerId: record.id,
      appId: record.packageId ?? record.id,
      componentId: record.id,
      capabilities: capabilities.map(({ id, version, resourceTypes }) => ({ id, version, resourceTypes })),
    }];
  });
}
