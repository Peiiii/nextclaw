import path from "node:path";
import type { AppPermissions, AppResolvedComponent } from "#app-runtime/types/app-manifest.types.js";
import { AppHomeService } from "#app-runtime/services/app-home.service.js";
import { AppInstanceStorageService } from "#app-runtime/services/app-instance-storage.service.js";
import { AppPlatformTargetService } from "#app-runtime/services/app-platform-target.service.js";
import type { AppInstanceRecord } from "#app-runtime/types/app-storage.types.js";
import type {
  AppRegistry,
  AppRegistryAppRecord,
  AppRegistryInstalledVersion,
  AppSecretBinding,
  AppSecretBindingMap,
} from "#app-runtime/types/app-registry.types.js";

const SAFE_APP_ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const SAFE_VERSION_PATTERN = /^[0-9A-Za-z]+(?:[._+-][0-9A-Za-z]+)*$/;
const SAFE_COMPONENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_SECRET_SLOT_ID_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;

export class AppRegistryParserService {
  private readonly instanceStorageService: AppInstanceStorageService;
  private readonly platformTargetService = new AppPlatformTargetService();

  constructor(private readonly appHomeService: AppHomeService) {
    this.instanceStorageService = new AppInstanceStorageService(appHomeService);
  }

  parse = (rawRegistry: unknown): AppRegistry => {
    const candidate = this.assertRecord(rawRegistry, "registry.json");
    if (candidate.schemaVersion !== 1) throw new Error("当前只支持 registry schemaVersion = 1。");
    const rawApps = this.assertRecord(candidate.apps, "registry.apps");
    const apps: Record<string, AppRegistryAppRecord> = {};
    for (const [appId, rawApp] of Object.entries(rawApps)) {
      if (!SAFE_APP_ID_PATTERN.test(appId)) throw new Error(`registry.apps 包含不安全的 appId：${appId}`);
      const app = this.assertRecord(rawApp, `registry.apps.${appId}`) as Partial<AppRegistryAppRecord>;
      const installedVersions = this.parseInstalledVersions(appId, app.installedVersions);
      const activeVersion = this.requireString(app.activeVersion, `registry.apps.${appId}.activeVersion`);
      if (!installedVersions[activeVersion]) throw new Error(`registry.apps.${appId} 缺少 activeVersion ${activeVersion}。`);
      const dataDirectory = this.requireString(app.dataDirectory, `registry.apps.${appId}.dataDirectory`);
      const firstInstalledAt = Object.values(installedVersions)
        .map((version) => version.installedAt)
        .filter((value): value is string => typeof value === "string")
        .sort()[0] ?? new Date(0).toISOString();
      const defaultInstance = this.parseDefaultInstance(app.defaultInstance, appId, dataDirectory, firstInstalledAt);
      apps[appId] = {
        ...(app as AppRegistryAppRecord),
        appId,
        publisher: app.publisher ?? installedVersions[activeVersion]?.publisher,
        enabled: typeof app.enabled === "boolean" ? app.enabled : true,
        activeVersion,
        dataDirectory: defaultInstance.storage.dataDirectory,
        defaultInstance,
        installedVersions,
        grants: app.grants && typeof app.grants === "object" ? app.grants : {},
        secretBindings: this.parseSecretBindings(app.secretBindings, `registry.apps.${appId}.secretBindings`),
      };
    }
    const suppressedBuiltIns = candidate.suppressedBuiltIns &&
      typeof candidate.suppressedBuiltIns === "object" && !Array.isArray(candidate.suppressedBuiltIns)
      ? Object.fromEntries(Object.entries(candidate.suppressedBuiltIns).flatMap(([appId, raw]) => {
          if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
          const suppressedAt = (raw as { suppressedAt?: unknown }).suppressedAt;
          return typeof suppressedAt === "string" ? [[appId, { suppressedAt }]] : [];
        }))
      : {};
    return { schemaVersion: 1, apps, suppressedBuiltIns };
  };

  parseSecretSlotId = (slotId: string, field: string): string => {
    if (!SAFE_SECRET_SLOT_ID_PATTERN.test(slotId)) throw new Error(`${field} 必须是稳定的 lowercase slot id。`);
    return slotId;
  };

  parseSecretBinding = (rawBinding: unknown, field: string): AppSecretBinding => {
    const binding = this.assertRecord(rawBinding, field);
    if (Object.prototype.hasOwnProperty.call(binding, "value")) throw new Error(`${field} 不能保存 Secret 明文。`);
    const unsupportedField = Object.keys(binding).find((key) => !["source", "provider", "id"].includes(key));
    if (unsupportedField) throw new Error(`${field} 只允许保存 source、provider 和 id。`);
    const source = this.requireString(binding.source, `${field}.source`);
    if (source !== "env" && source !== "file" && source !== "exec") {
      throw new Error(`${field}.source 只支持 env、file 或 exec。`);
    }
    return {
      source,
      provider: binding.provider === undefined ? undefined : this.requireString(binding.provider, `${field}.provider`),
      id: this.requireString(binding.id, `${field}.id`),
    };
  };

  retainDeclaredSecretBindings = (bindings: AppSecretBindingMap, permissions: AppPermissions): AppSecretBindingMap => {
    const declared = new Set((permissions.secrets ?? []).map((slot) => slot.id));
    return Object.fromEntries(Object.entries(bindings).filter(([slotId]) => declared.has(slotId)));
  };

  private parseInstalledVersions = (appId: string, raw: unknown): Record<string, AppRegistryInstalledVersion> => {
    const installedVersions: Record<string, AppRegistryInstalledVersion> = {};
    const rawVersions = this.assertRecord(raw, `registry.apps.${appId}.installedVersions`);
    for (const [version, rawVersion] of Object.entries(rawVersions)) {
      if (!SAFE_VERSION_PATTERN.test(version)) throw new Error(`registry.apps.${appId} 包含不安全的版本：${version}`);
      const field = `registry.apps.${appId}.installedVersions.${version}`;
      const versionRecord = this.assertRecord(rawVersion, field) as Partial<AppRegistryInstalledVersion>;
      const installDirectory = this.requireString(versionRecord.installDirectory, `${field}.installDirectory`);
      this.assertExactPath(installDirectory, this.appHomeService.getInstallDirectory(appId, version), `${field}.installDirectory`);
      installedVersions[version] = {
        ...(versionRecord as AppRegistryInstalledVersion),
        version,
        installDirectory: path.resolve(installDirectory),
        manifestSchemaVersion: versionRecord.manifestSchemaVersion === 2 ? 2 : 1,
        target: versionRecord.target === undefined ? undefined : this.platformTargetService.parseArtifactTarget(versionRecord.target, `${field}.target`),
        components: this.parseComponents(versionRecord.components, installDirectory, `${field}.components`),
        dataSchemaVersion: typeof versionRecord.dataSchemaVersion === "number" &&
          Number.isSafeInteger(versionRecord.dataSchemaVersion) && versionRecord.dataSchemaVersion > 0
          ? versionRecord.dataSchemaVersion : 1,
      };
    }
    return installedVersions;
  };

  private parseDefaultInstance = (raw: unknown, appId: string, dataDirectory: string, createdAt: string): AppInstanceRecord => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      this.assertExactPath(dataDirectory, this.appHomeService.getAppDataDirectory(appId), `registry.apps.${appId}.dataDirectory`);
      return this.instanceStorageService.buildLegacyDefaultInstance({ appId, dataDirectory, createdAt });
    }
    const instance = raw as Partial<AppInstanceRecord>;
    if (instance.id !== "default" || !instance.storage || typeof instance.storage !== "object" ||
      (instance.storage.layout !== "legacy" && instance.storage.layout !== "instance-v1")) {
      throw new Error(`registry.apps.${appId}.defaultInstance 无效。`);
    }
    if (instance.publisherId !== undefined && typeof instance.publisherId !== "string") {
      throw new Error(`registry.apps.${appId}.defaultInstance.publisherId 无效。`);
    }
    const dataSchemaVersion = typeof instance.dataSchemaVersion === "number" && Number.isSafeInteger(instance.dataSchemaVersion) && instance.dataSchemaVersion > 0
      ? instance.dataSchemaVersion : 1;
    const instanceCreatedAt = typeof instance.createdAt === "string" ? instance.createdAt : createdAt;
    const instanceDirectory = path.resolve(this.appHomeService.getAppInstanceDirectory(appId, "default"));
    const expectedStorage = {
      layout: "instance-v1" as const, layoutVersion: 1 as const, instanceId: "default", instanceDirectory,
      dataDirectory: path.join(instanceDirectory, "data"), configDirectory: path.join(instanceDirectory, "config"),
      stateDirectory: path.join(instanceDirectory, "state"), cacheDirectory: path.join(instanceDirectory, "cache"),
      temporaryDirectory: path.join(instanceDirectory, "tmp"), logsDirectory: path.join(instanceDirectory, "logs"),
    };
    if (instance.storage.layout === "legacy") {
      const legacy = this.appHomeService.getAppDataDirectory(appId);
      this.assertExactPath(dataDirectory, legacy, `registry.apps.${appId}.dataDirectory`);
      return { id: "default", publisherId: instance.publisherId, storage: { ...expectedStorage, layout: "legacy", dataDirectory: path.resolve(legacy) }, dataSchemaVersion, createdAt: instanceCreatedAt, migratedAt: instance.migratedAt, legacyDataDirectory: path.resolve(legacy) };
    }
    for (const [field, expectedPath] of Object.entries(expectedStorage).filter(([key]) => key.endsWith("Directory"))) {
      this.assertExactPath(instance.storage[field as keyof typeof instance.storage], expectedPath as string, `registry.apps.${appId}.defaultInstance.storage.${field}`);
    }
    this.assertExactPath(dataDirectory, expectedStorage.dataDirectory, `registry.apps.${appId}.dataDirectory`);
    return { id: "default", publisherId: instance.publisherId, storage: expectedStorage, dataSchemaVersion, createdAt: instanceCreatedAt, migratedAt: instance.migratedAt, legacyDataDirectory: instance.legacyDataDirectory };
  };

  private parseSecretBindings = (raw: unknown, field: string): AppSecretBindingMap => {
    if (raw === undefined) return {};
    return Object.fromEntries(Object.entries(this.assertRecord(raw, field)).map(([slotId, binding]) => {
      const normalized = this.parseSecretSlotId(slotId, `${field} slot id`);
      return [normalized, this.parseSecretBinding(binding, `${field}.${normalized}`)];
    }));
  };

  private parseComponents = (raw: unknown, installDirectory: string, field: string): AppResolvedComponent[] | undefined => {
    if (raw === undefined) return undefined;
    if (!Array.isArray(raw)) throw new Error(`${field} 必须是数组。`);
    return raw.map((item, index) => {
      const component = this.assertRecord(item, `${field}[${index}]`);
      if (component.kind !== "panel" && component.kind !== "service") throw new Error(`${field}[${index}].kind 无效。`);
      const id = this.requireString(component.id, `${field}[${index}].id`);
      if (!SAFE_COMPONENT_ID_PATTERN.test(id)) throw new Error(`${field}[${index}].id 不安全。`);
      const relativePath = this.requireString(component.path, `${field}[${index}].path`);
      const directory = path.resolve(installDirectory, relativePath);
      const relative = path.relative(path.resolve(installDirectory), directory);
      if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`${field}[${index}].path 必须位于版本目录内。`);
      const manifestPath = path.join(directory, component.kind === "panel" ? "panel-app.json" : "service-app.json");
      this.assertExactPath(component.componentDirectory, directory, `${field}[${index}].componentDirectory`);
      this.assertExactPath(component.manifestPath, manifestPath, `${field}[${index}].manifestPath`);
      return { kind: component.kind, id, path: relativePath, componentDirectory: directory, manifestPath };
    });
  };

  private assertExactPath = (actual: unknown, expected: string, field: string): void => {
    if (typeof actual !== "string" || path.resolve(actual) !== path.resolve(expected)) throw new Error(`${field} 必须位于受管路径 ${path.resolve(expected)}。`);
  };

  private assertRecord = (value: unknown, field: string): Record<string, unknown> => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${field} 必须是对象。`);
    return value as Record<string, unknown>;
  };

  private requireString = (value: unknown, field: string): string => {
    if (typeof value !== "string" || !value.trim()) throw new Error(`${field} 必须是非空字符串。`);
    return value;
  };
}
