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
    await Promise.allSettled(this.order(active).map(async ({ manifest, record }) =>
      await this.params.runtimeService.start?.({ app: record, manifest })
    ));
  };

  activatePackageComponents = async (
    components: AppPackageComponentSource[],
  ): Promise<void> => {
    const registrations: LifecycleRegistration[] = [];
    for (const component of components.filter((entry) => entry.kind === "service")) {
      const manifest = await readServiceAppManifest(component.sourcePath);
      if (!manifest.lifecycle || manifest.lifecycle.mode === "action") continue;
      registrations.push({
        manifest,
        record: this.params.recordService.fromManifest(
          component.sourcePath,
          manifest,
          component,
          component.storage,
        ),
      });
    }
    for (const { manifest, record } of this.order(registrations)) {
      await this.params.runtimeService.start?.({ app: record, manifest });
    }
  };

  deactivatePackageComponents = async (
    components: AppPackageComponentSource[],
  ): Promise<void> => {
    const serviceIds = components
      .filter((component) => component.kind === "service")
      .map((component) => component.id);
    await Promise.all(serviceIds.map(async (serviceId) =>
      await this.params.runtimeService.stop(serviceId)
    ));
  };

  private order = (registrations: LifecycleRegistration[]): LifecycleRegistration[] => [
    ...registrations.filter(({ manifest }) => manifest.lifecycle?.mode === "provider"),
    ...registrations.filter(({ manifest }) => manifest.lifecycle?.mode === "resident"),
  ];
}
