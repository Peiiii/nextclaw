import type { AppManifestBundle } from "#app-runtime/types/app-manifest.types.js";
import type { AppPublisher } from "#app-runtime/types/app-remote-registry.types.js";
import type { AppRegistryAppRecord } from "#app-runtime/types/app-registry.types.js";
import type { ResolvedAppInstallSource } from "#app-runtime/services/app-install-source.service.js";

export function resolveAppInstallationContract(params: {
  appId: string;
  existingRecord?: AppRegistryAppRecord;
  manifestBundle: AppManifestBundle;
  source: ResolvedAppInstallSource;
  trustedPublisher?: AppPublisher;
}): {
  currentPublisher?: AppPublisher;
  dataSchemaVersion: number;
  publisher?: AppPublisher;
} {
  const publisher = params.source.kind === "registry"
    ? params.source.registryResolution.publisher
    : params.trustedPublisher;
  const currentPublisher = params.existingRecord?.publisher ??
    params.existingRecord?.installedVersions[params.existingRecord.activeVersion]?.publisher;
  if (currentPublisher && currentPublisher.id !== publisher?.id) {
    throw new Error(
      `应用 ${params.appId} 已绑定发布者 ${currentPublisher.id}，拒绝由 ${publisher?.id ?? "未验证本地来源"} 覆盖。`,
    );
  }
  const dataSchemaVersion = params.manifestBundle.manifest.schemaVersion === 2
    ? params.manifestBundle.manifest.storage?.schemaVersion ?? 1
    : 1;
  const currentSchemaVersion = params.existingRecord?.defaultInstance.dataSchemaVersion;
  if (currentSchemaVersion !== undefined && currentSchemaVersion !== dataSchemaVersion) {
    throw new Error(
      `应用 ${params.appId} 数据 schema 从 ${currentSchemaVersion} 升级到 ${dataSchemaVersion}，但包内没有受支持的迁移合同。更新已停止，现有数据和版本保持不变。`,
    );
  }
  return { currentPublisher, dataSchemaVersion, publisher };
}
