import type {
  AppInfoResult,
  AppInstallationService,
  AppRegistryService,
} from "@nextclaw/app-runtime";
import {
  AppPackageError,
  type AppPackageDependencyBinding,
  type AppPackageDependencyBindingInput,
  type AppPackageDependencyView,
  type AppPackageComponentSource,
  type AppPackageComponentSourceList,
  type AppPackageRuntimeHooks,
  type AppPackageView,
  type CapabilityProviderView,
} from "@kernel/types/app-package.types.js";
import {
  AppPackageDependencyService,
  type AppPackageDependencyTarget,
} from "@kernel/services/app-package-dependency.service.js";

/**
 * Bridges the package lifecycle owner to dependency persistence. It keeps all
 * Provider queries and binding mutations on the one dependency service path.
 */
export class AppPackageDependencyCoordinator {
  private readonly dependencyService: AppPackageDependencyService;

  constructor(private readonly params: {
    installationService: AppInstallationService;
    registryService: AppRegistryService;
    listCapabilityProviders: () => ReturnType<AppPackageRuntimeHooks["listCapabilityProviders"]>;
    resolveSecurity: (
      version: NonNullable<Awaited<ReturnType<AppRegistryService["getApp"]>>>["installedVersions"][string],
      appId: string,
    ) => Pick<AppPackageComponentSource, "runtimeProfile" | "isolation" | "permissions">;
    dependencyService?: AppPackageDependencyService;
  }) {
    this.dependencyService = params.dependencyService ?? new AppPackageDependencyService();
  }

  inspect = async (appId: string): Promise<AppPackageDependencyView> =>
    await this.inspectTarget(await this.getTarget(appId));

  verify = async (appId: string): Promise<AppPackageDependencyView> => await this.inspect(appId);

  setup = async (appId: string): Promise<AppPackageDependencyView> =>
    await this.params.installationService.withAppOperation(appId, async () => {
      const info = await this.getMutableTargetInfo(appId);
      return await this.dependencyService.setup({
        target: this.targetForInfo(info),
        providers: await this.params.listCapabilityProviders(),
      });
    });

  bind = async (
    appId: string,
    input: AppPackageDependencyBindingInput,
  ): Promise<AppPackageDependencyView> =>
    await this.params.installationService.withAppOperation(appId, async () => {
      const info = await this.getMutableTargetInfo(appId);
      return await this.dependencyService.bind({
        target: this.targetForInfo(info),
        providers: await this.params.listCapabilityProviders(),
        input,
      });
    });

  unbind = async (
    appId: string,
    input: Omit<AppPackageDependencyBindingInput, "providerId">,
  ): Promise<AppPackageDependencyView> =>
    await this.params.installationService.withAppOperation(appId, async () => {
      const info = await this.getMutableTargetInfo(appId);
      return await this.dependencyService.unbind({
        target: this.targetForInfo(info),
        providers: await this.params.listCapabilityProviders(),
        input,
      });
    });

  inspectTarget = async (
    target: AppPackageDependencyTarget,
    providers?: CapabilityProviderView[],
  ): Promise<AppPackageDependencyView> => await this.dependencyService.inspect({
    target,
    providers: providers ?? await this.params.listCapabilityProviders(),
  });

  resolveStoredProviderIds = async (
    target: AppPackageDependencyTarget,
  ): Promise<Record<string, string[]>> =>
    await this.dependencyService.resolveStoredProviderIds(target);

  listBindings = async (
    target: AppPackageDependencyTarget,
  ): Promise<AppPackageDependencyBinding[]> => await this.dependencyService.listBindings(target);

  listActiveComponentSourcesWithDiagnostics = async (): Promise<AppPackageComponentSourceList> => {
    const records = await this.params.registryService.listApps();
    const results = await Promise.all(records
      .filter((record) => record.enabled)
      .map(async (record) => {
        try {
          await this.params.installationService.assertVersionIntegrity(record.appId, record.activeVersion);
          const version = record.installedVersions[record.activeVersion];
          if (!version || version.manifestSchemaVersion !== 2) return { sources: [] };
          const target = this.target({
            appId: record.appId,
            storage: record.defaultInstance.storage,
            components: version.components ?? [],
          });
          // Do not query the live catalog here: its Service projection consumes
          // this source list. Bind validates candidates before persisting, and
          // readiness rechecks liveness before every enable operation.
          const resolvedProviderIds = await this.resolveStoredProviderIds(target);
          return { sources: (version.components ?? []).map((component) => ({
            kind: component.kind,
            id: component.id,
            packageId: record.appId,
            packageVersion: record.activeVersion,
            sourcePath: component.componentDirectory,
            manifestPath: component.manifestPath,
            dataDirectory: record.dataDirectory,
            instanceId: record.defaultInstance.id,
            storage: record.defaultInstance.storage,
            resolvedProviderIds: resolvedProviderIds[component.id],
            ...this.params.resolveSecurity(version, record.appId),
          })) };
        } catch (error) {
          return { sources: [], unavailablePackage: {
            appId: record.appId,
            message: error instanceof Error ? error.message : String(error),
          } };
        }
      }));
    return {
      sources: results.flatMap((result) => result.sources),
      unavailablePackages: results.flatMap((result) => result.unavailablePackage ?? []),
    };
  };

  assertNoEnabledDependents = async (provider: AppPackageView): Promise<void> => {
    const providerIds = new Set(provider.components
      .filter((component) => component.kind === "service")
      .map((component) => component.id));
    if (providerIds.size === 0) return;
    const records = await this.params.registryService.listApps();
    const consumers = await Promise.all(records
      .filter((record) => record.enabled && record.appId !== provider.id)
      .map(async (record) => {
        const bindings = await this.listBindings(this.targetForInfo(
          await this.params.installationService.info(record.appId),
        ));
        return bindings.some((binding) => providerIds.has(binding.providerId))
          ? record.appId
          : undefined;
      }));
    const dependentAppIds = consumers.filter((entry): entry is string => Boolean(entry));
    if (dependentAppIds.length === 0) return;
    throw new AppPackageError(
      "APP_PACKAGE_CONFLICT",
      `App ${provider.id} is required by enabled App${dependentAppIds.length === 1 ? "" : "s"}: ${dependentAppIds.join(", ")}. Unbind or disable those Apps first.`,
    );
  };

  targetForInfo = (
    info: AppInfoResult,
    selectedVersion: string = info.activeVersion,
  ): AppPackageDependencyTarget => {
    const version = info.installedVersions.find((entry) => entry.version === selectedVersion);
    if (!version) {
      throw new AppPackageError(
        "APP_PACKAGE_OPERATION_FAILED",
        `应用 ${info.appId} 缺少版本 ${selectedVersion}。`,
      );
    }
    return this.target({
      appId: info.appId,
      storage: info.storage,
      components: version.components ?? [],
    });
  };

  target = (params: {
    appId: string;
    storage: AppPackageDependencyTarget["storage"];
    components: Array<{ id: string; kind: "panel" | "service"; componentDirectory: string }>;
  }): AppPackageDependencyTarget => ({
    appId: params.appId,
    storage: params.storage,
    components: params.components.map((component) => ({
      id: component.id,
      kind: component.kind,
      componentDirectory: component.componentDirectory,
    })),
  });

  assertReadyToEnable = (app: AppPackageView): void => {
    if (app.readiness.status === "ready") return;
    const required = app.readiness.requirements.map((requirement) => requirement.title).join(", ");
    const reason = app.readiness.status === "needs-capability"
      ? "an additional capability is required"
      : "external service setup is required";
    throw new AppPackageError(
      "APP_PACKAGE_NOT_READY",
      `App ${app.id} is not ready to enable: ${reason}${required ? ` (${required})` : ""}.`,
    );
  };

  private getTarget = async (appId: string): Promise<AppPackageDependencyTarget> =>
    this.targetForInfo(await this.params.installationService.info(appId));

  private getMutableTargetInfo = async (appId: string): Promise<AppInfoResult> => {
    const info = await this.params.installationService.info(appId);
    if (info.enabled) {
      throw new AppPackageError(
        "APP_PACKAGE_CONFLICT",
        `App ${appId} must be disabled before changing dependency bindings.`,
      );
    }
    return info;
  };
}
