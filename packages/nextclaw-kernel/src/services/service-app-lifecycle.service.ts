import type { AppPackageComponentSource } from "@kernel/types/app-package.types.js";
import type {
  ServiceAppManifest,
  ServiceAppRecord,
} from "@kernel/types/service-app.types.js";
import type { ServiceAppRecordService } from "@kernel/services/service-app-record.service.js";
import { readServiceAppManifest } from "@kernel/utils/service-app-manifest.utils.js";

type LifecycleRegistration = {
  manifest: ServiceAppManifest;
  record: ServiceAppRecord;
};

type LifecycleRuntime = {
  start?: (registration: {
    app: ServiceAppRecord;
    manifest: ServiceAppManifest;
  }) => Promise<void>;
  stop: (appId: string) => Promise<void>;
};

export class ServiceAppLifecycleService {
  constructor(private readonly params: {
    recordService: ServiceAppRecordService;
    runtimeService: LifecycleRuntime;
  }) {}

  startDiscovered = async (registrations: LifecycleRegistration[]): Promise<void> => {
    const active = registrations.filter(
      ({ manifest, record }) =>
        record.enabled && manifest.lifecycle && manifest.lifecycle.mode !== "action",
    );
    for (const { manifest, record } of this.order(active)) {
      try {
        await this.params.runtimeService.start?.({ app: record, manifest });
      } catch {
        // Discovery remains best-effort, but ordering is intentionally serial:
        // a Consumer must never race its declared Provider during recovery.
      }
    }
  };

  activatePackageComponents = async (
    components: AppPackageComponentSource[],
  ): Promise<void> => {
    const persistent = (await this.registrationsFor(components)).filter(
      ({ manifest }) => manifest.lifecycle && manifest.lifecycle.mode !== "action",
    );
    for (const { manifest, record } of this.order(persistent)) {
      await this.params.runtimeService.start?.({ app: record, manifest });
    }
  };

  deactivatePackageComponents = async (
    components: AppPackageComponentSource[],
  ): Promise<void> => {
    const registrations = await this.registrationsFor(components);
    for (const { record } of this.order(registrations).reverse()) {
      await this.params.runtimeService.stop(record.id);
    }
  };

  private registrationsFor = async (
    components: AppPackageComponentSource[],
  ): Promise<LifecycleRegistration[]> => {
    const registrations: LifecycleRegistration[] = [];
    for (const component of components.filter((entry) => entry.kind === "service")) {
      const manifest = await readServiceAppManifest(component.sourcePath);
      if (!manifest.lifecycle || manifest.lifecycle.mode === "action") continue;
      registrations.push({
        manifest,
        record: this.params.recordService.fromManifest(
          component.sourcePath, manifest, component, component.storage,
        ),
      });
    }
    return registrations;
  };

  private order = (registrations: LifecycleRegistration[]): LifecycleRegistration[] => {
    const byId = new Map(registrations.map((registration) => [registration.record.id, registration]));
    const ordered: LifecycleRegistration[] = [];
    const visited = new Set<string>();
    const visit = (registration: LifecycleRegistration): void => {
      if (visited.has(registration.record.id)) return;
      visited.add(registration.record.id);
      for (const providerId of [...(registration.record.providerIds ?? [])].sort()) {
        const provider = byId.get(providerId);
        if (provider) visit(provider);
      }
      ordered.push(registration);
    };
    for (const registration of [...registrations].sort((left, right) => left.record.id.localeCompare(right.record.id))) {
      visit(registration);
    }
    return ordered;
  };
}
