import { join } from "node:path";
import type { AppPackageComponentSource } from "@kernel/types/app-package.types.js";
import { AppPackageError } from "@kernel/types/app-package.types.js";
import type { ServiceAppAiCapabilityService } from "@kernel/services/service-app-ai-capability.service.js";
import type { ServiceAppRecordService } from "@kernel/services/service-app-record.service.js";
import type { ServiceAppManifest, ServiceAppRecord } from "@kernel/types/service-app.types.js";
import { readServiceAppManifest } from "@kernel/utils/service-app-manifest.utils.js";
import { mergeServiceAppRuntimeActions } from "@kernel/utils/service-app-runtime-action.utils.js";

type ProbeRuntime = {
  restart: (appId: string) => Promise<void>;
  listActions: (params: { app: ServiceAppRecord; manifest: ServiceAppManifest }) => Promise<unknown[]>;
  getStatus: (appId: string) => { status: string; lastError?: string };
};

export class ServiceAppActivationManager {
  constructor(private readonly params: {
    runtime: ProbeRuntime;
    records: ServiceAppRecordService;
    aiCapabilities: ServiceAppAiCapabilityService;
    getWorkspaceServiceAppsPath: () => string;
    listWorkspaceDirectoryNames: (path: string) => Promise<string[]>;
    listPackageComponentSources: () => Promise<AppPackageComponentSource[]>;
  }) {}

  assertCanActivate = async (components: AppPackageComponentSource[]): Promise<void> => {
    const services = components.filter((component) => component.kind === "service");
    if (services.length === 0) return;
    await this.assertNoConflicts(services);
    for (const component of services) await this.probe(component);
  };

  private assertNoConflicts = async (components: AppPackageComponentSource[]): Promise<void> => {
    const workspacePath = this.params.getWorkspaceServiceAppsPath();
    const workspaceIds = new Set<string>();
    for (const dirName of await this.params.listWorkspaceDirectoryNames(workspacePath)) {
      try { workspaceIds.add((await readServiceAppManifest(join(workspacePath, dirName))).id); } catch { /* invalid entries are listed elsewhere */ }
    }
    const activeSources = await this.params.listPackageComponentSources();
    for (const component of components) {
      const packageConflict = activeSources.some((active) => active.kind === "service" && active.id === component.id && active.packageId !== component.packageId);
      if (workspaceIds.has(component.id) || packageConflict) throw new AppPackageError("APP_PACKAGE_CONFLICT", `Service component id 冲突：${component.id}`);
    }
  };

  private probe = async (component: AppPackageComponentSource): Promise<void> => {
    let manifest: ServiceAppManifest;
    try { manifest = await readServiceAppManifest(component.sourcePath); }
    catch (error) {
      throw new AppPackageError("APP_PACKAGE_OPERATION_FAILED", `Service component ${component.id} manifest 无效：${error instanceof Error ? error.message : String(error)}`);
    }
    const record = this.params.records.fromManifest(component.sourcePath, manifest, component, component.storage);
    try { await this.params.aiCapabilities.assertReady(record, manifest); }
    catch (error) {
      throw new AppPackageError("APP_PACKAGE_OPERATION_FAILED", `Service component ${component.id} required AI capability slots are not ready: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      await this.params.runtime.restart(component.id);
      const runtimeActions = await this.params.runtime.listActions({ app: record, manifest });
      const runtimeStatus = this.params.runtime.getStatus(component.id);
      if (runtimeStatus.status === "failed") throw new AppPackageError("APP_PACKAGE_OPERATION_FAILED", `Service component ${component.id} 启动探测失败：${runtimeStatus.lastError ?? "unknown error"}`);
      const invalid = mergeServiceAppRuntimeActions({ record, manifest, runtimeActions: runtimeActions as never[] })
        .find((action) => action.runtimeState === "missing" || action.runtimeState === "undeclared");
      if (invalid) throw new AppPackageError("APP_PACKAGE_OPERATION_FAILED", `Service component ${component.id} action 合同不一致：${invalid.id} (${invalid.runtimeState})`);
    } finally {
      await this.params.runtime.restart(component.id);
    }
  };
}
