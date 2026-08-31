import path from "node:path";
import { resolveSecretRef, type Config } from "@nextclaw/core";
import type {
  AppGrantService,
  AppInfoResult,
  AppInstallationService,
  AppManifestService,
  AppRegistryService,
  AppSecretBinding,
} from "@nextclaw/app-runtime";
import type { AppPackageDependencyCoordinator } from "@kernel/services/app-package-dependency-coordinator.service.js";
import type { AppPackagePresentationService } from "@kernel/services/app-package-presentation.service.js";
import {
  AppPackageError,
  type AppPackageReadiness,
  type AppPackageSecretReadiness,
  type AppPackageSecretSlotView,
  type AppPackageView,
  type CapabilityProviderView,
} from "@kernel/types/app-package.types.js";
import { satisfiesAppEngineVersion } from "@kernel/utils/app-engine-version.utils.js";

export class AppPackageReadinessManager {
  constructor(
    private readonly params: {
      manifestService: AppManifestService;
      installationService: AppInstallationService;
      presentationService: AppPackagePresentationService;
      dependencyCoordinator: AppPackageDependencyCoordinator;
      registryService: AppRegistryService;
      grantService: AppGrantService;
      productVersion?: string;
      getSecretConfig?: () => Config;
      secretConfigPath?: string;
      isBuiltInAppId: (appId: string) => Promise<boolean>;
    },
  ) {}

  toPackageView = async (
    info: AppInfoResult,
    selectedVersion: string = info.activeVersion,
    providers?: CapabilityProviderView[],
  ): Promise<AppPackageView> => {
    const activeVersion = info.installedVersions.find(
      (version) => version.version === selectedVersion,
    );
    if (!activeVersion)
      throw new AppPackageError(
        "APP_PACKAGE_OPERATION_FAILED",
        `应用 ${info.appId} 缺少版本 ${selectedVersion}。`,
      );
    const packagePresentation =
      await this.params.presentationService.readManifest(
        path.join(activeVersion.installDirectory, "manifest.json"),
      );
    const manifestBundle = await this.params.manifestService.load(
      activeVersion.installDirectory,
    );
    const security =
      manifestBundle.manifest.schemaVersion === 2
        ? this.params.manifestService.resolvePlatformSecurity(
            manifestBundle.manifest,
          )
        : {
            runtimeProfile: "wasi" as const,
            isolation:
              manifestBundle.manifest.main.kind === "wasi-http-component"
                ? ("host-mediated" as const)
                : ("sandboxed" as const),
            permissions: manifestBundle.manifest.permissions ?? {},
          };
    const [dependencies, secrets, documentAccess] = await Promise.all([
      this.params.dependencyCoordinator.inspectTarget(
        this.params.dependencyCoordinator.targetForInfo(info, selectedVersion),
        providers,
      ),
      this.inspectSecretsForInfo(info, true, selectedVersion),
      this.params.grantService
        .summarize(info.appId)
        .then((state) => state.documentAccess),
    ]);
    return {
      id: info.appId,
      name: info.name,
      description: info.description,
      icon: packagePresentation.icon,
      nameI18n: packagePresentation.nameI18n,
      descriptionI18n: packagePresentation.descriptionI18n,
      activeVersion: selectedVersion,
      installedVersions: info.installedVersions.map(
        (version) => version.version,
      ),
      enabled: info.enabled,
      builtIn: await this.params.isBuiltInAppId(info.appId),
      primaryPanelId: activeVersion.primaryPanelId,
      components: await Promise.all(
        (activeVersion.components ?? []).map(async (component) => ({
          kind: component.kind,
          id: component.id,
          packageId: info.appId,
          packageVersion: selectedVersion,
          sourcePath: component.componentDirectory,
          manifestPath: component.manifestPath,
          dataDirectory: info.dataDirectory,
          instanceId: info.instance.id,
          storage: info.storage,
          runtimeProfile: security.runtimeProfile,
          isolation: security.isolation,
          permissions: security.permissions,
          resolvedProviderIds: dependencies.resolvedProviderIds[component.id],
          ...(await this.params.presentationService.readManifest(
            component.manifestPath,
          )),
        })),
      ),
      dataDirectory: info.dataDirectory,
      instanceId: info.instance.id,
      storage: info.storage,
      storageUsage: info.storageUsage,
      runtimeProfile: security.runtimeProfile,
      isolation: security.isolation,
      readiness: this.combineReadiness(
        dependencies.readiness,
        secrets.readiness,
      ),
      secrets,
      dependencies,
      documentAccess,
    };
  };

  inspectSecrets = async (
    info: AppInfoResult,
    verify: boolean,
    selectedVersion = info.activeVersion,
  ): Promise<AppPackageSecretReadiness> => {
    const version = info.installedVersions.find(
      (entry) => entry.version === selectedVersion,
    );
    if (!version)
      throw new AppPackageError(
        "APP_PACKAGE_OPERATION_FAILED",
        `应用 ${info.appId} 缺少版本 ${selectedVersion}。`,
      );
    const record = await this.params.registryService.getApp(info.appId);
    if (!record)
      throw new AppPackageError(
        "APP_PACKAGE_NOT_FOUND",
        `未找到已安装应用：${info.appId}`,
      );
    const slots = (version.permissions.secrets ?? []).map((slot) =>
      this.inspectSecretSlot(slot, record.secretBindings[slot.id], verify),
    );
    const requirements = slots
      .filter(
        (slot) =>
          slot.required &&
          (slot.status === "unbound" || slot.status === "unresolved"),
      )
      .map((slot) => ({
        componentId: "package",
        kind: "configuration" as const,
        id: `secret:${slot.id}`,
        title: slot.title,
        description: slot.description,
        remediation: {
          kind: "agent-setup" as const,
          summary: `Bind and verify the Secret slot ${slot.id}.`,
          requiresUserAction: true,
        },
      }));
    return {
      readiness: {
        status: requirements.length === 0 ? "ready" : "needs-configuration",
        requirements,
      },
      slots,
    };
  };

  assertSecretsReady = (app: AppPackageView): void => {
    const unresolved = app.secrets.slots.find(
      (slot) => slot.required && slot.status !== "ready",
    );
    if (!unresolved) return;
    throw new AppPackageError(
      unresolved.errorCode ?? "SECRET_RESOLUTION_FAILED",
      unresolved.errorCode === "SECRET_BINDING_MISSING"
        ? `App ${app.id} requires Secret slot ${unresolved.id} before it can be enabled.`
        : `App ${app.id} cannot resolve Secret slot ${unresolved.id}; verify its binding before enabling.`,
    );
  };

  assertEngineCompatibility = async (
    appId: string,
    selectedVersion?: string,
  ): Promise<void> => {
    const productVersion = this.params.productVersion?.trim();
    if (!productVersion) return;
    const info = await this.params.installationService.info(appId);
    const targetVersion = selectedVersion ?? info.activeVersion;
    const activeVersion = info.installedVersions.find(
      (version) => version.version === targetVersion,
    );
    if (!activeVersion)
      throw new AppPackageError(
        "APP_PACKAGE_OPERATION_FAILED",
        `应用 ${appId} 缺少版本 ${targetVersion}。`,
      );
    const manifestBundle = await this.params.manifestService.load(
      activeVersion.installDirectory,
    );
    const engineRange =
      manifestBundle.manifest.schemaVersion === 2
        ? manifestBundle.manifest.engines?.nextclaw?.trim()
        : undefined;
    if (
      engineRange &&
      !satisfiesAppEngineVersion(productVersion, engineRange)
    ) {
      throw new AppPackageError(
        "APP_PACKAGE_INCOMPATIBLE",
        `应用 ${appId}@${targetVersion} 要求 NextClaw ${engineRange}，当前版本为 ${productVersion}。`,
      );
    }
  };

  private inspectSecretsForInfo = async (
    info: AppInfoResult,
    verify: boolean,
    selectedVersion: string,
  ): Promise<AppPackageSecretReadiness> =>
    await this.inspectSecrets(info, verify, selectedVersion);

  private inspectSecretSlot = (
    slot: Omit<AppPackageSecretSlotView, "status" | "binding" | "errorCode">,
    binding: AppSecretBinding | undefined,
    verify: boolean,
  ): AppPackageSecretSlotView => {
    if (!binding)
      return {
        ...slot,
        status: "unbound",
        errorCode: "SECRET_BINDING_MISSING",
      };
    if (!verify) return { ...slot, status: "bound", binding };
    try {
      const config = this.params.getSecretConfig?.();
      if (!config) throw new Error("Secret resolution is unavailable.");
      void resolveSecretRef(config, binding, {
        configPath: this.params.secretConfigPath,
      });
      return { ...slot, status: "ready", binding };
    } catch {
      return {
        ...slot,
        status: "unresolved",
        binding,
        errorCode: "SECRET_RESOLUTION_FAILED",
      };
    }
  };

  private combineReadiness = (
    left: AppPackageReadiness,
    right: AppPackageReadiness,
  ): AppPackageReadiness => ({
    status:
      left.status === "needs-configuration" ||
      right.status === "needs-configuration"
        ? "needs-configuration"
        : left.status === "needs-capability"
          ? "needs-capability"
          : "ready",
    requirements: [...left.requirements, ...right.requirements],
  });
}
