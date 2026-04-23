import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { AppRegistryConfigService } from "./app-registry-config.service.js";
import type {
  AppRemoteRegistryDocument,
  AppRemoteRegistryResolution,
  AppRemoteRegistryVersion,
} from "./app-remote-registry.types.js";

export class AppRemoteRegistryClientService {
  constructor(
    private readonly configService: AppRegistryConfigService = new AppRegistryConfigService(),
  ) {}

  resolve = async (params: {
    appId: string;
    version?: string;
    registryUrl?: string;
  }): Promise<AppRemoteRegistryResolution> => {
    const { appId, version: requestedVersion, registryUrl: overrideRegistryUrl } = params;
    const registryUrl = overrideRegistryUrl
      ? this.normalizeRegistryUrl(overrideRegistryUrl)
      : (await this.configService.getSnapshot()).currentUrl;
    const metadataUrl = new URL(encodeURIComponent(appId), registryUrl).toString();
    const response = await fetch(metadataUrl);
    if (!response.ok) {
      throw new Error(
        `无法从 registry 拉取 ${appId} metadata：${response.status} ${response.statusText}`,
      );
    }
    const document = this.parseDocument(await response.json(), appId);
    const version = requestedVersion ?? document["dist-tags"].latest;
    const versionRecord = document.versions[version];
    if (!versionRecord) {
      throw new Error(`registry ${registryUrl} 未提供 ${appId}@${version}。`);
    }
    return {
      registryUrl,
      metadataUrl,
      appId,
      version,
      description: versionRecord.description ?? document.description,
      publisher: versionRecord.publisher,
      permissions: versionRecord.permissions,
      distributionMode: versionRecord.dist.kind === "source" ? "source" : "bundle",
      bundleUrl: new URL(
        versionRecord.dist.artifact ??
          versionRecord.dist.source ??
          versionRecord.dist.bundle,
        metadataUrl,
      ).toString(),
      sha256: versionRecord.dist.sha256,
    };
  };

  downloadBundle = async (params: {
    resolution: AppRemoteRegistryResolution;
    targetDirectory: string;
  }): Promise<{
    bundlePath: string;
  }> => {
    const { resolution, targetDirectory } = params;
    const response = await fetch(resolution.bundleUrl);
    if (!response.ok) {
      throw new Error(
        `无法下载 bundle：${resolution.bundleUrl} (${response.status} ${response.statusText})`,
      );
    }
    const bundleBytes = Buffer.from(await response.arrayBuffer());
    const actualSha256 = createHash("sha256").update(bundleBytes).digest("hex");
    if (actualSha256 !== resolution.sha256) {
      throw new Error(
        `bundle checksum 校验失败：期望 ${resolution.sha256}，实际 ${actualSha256}`,
      );
    }
    const bundlePath = path.join(
      targetDirectory,
      `${this.normalizeBundleFileName(resolution.appId)}-${resolution.version}.napp`,
    );
    await writeFile(bundlePath, bundleBytes);
    return {
      bundlePath,
    };
  };

  private parseDocument = (
    rawDocument: unknown,
    appId: string,
  ): AppRemoteRegistryDocument => {
    if (!rawDocument || typeof rawDocument !== "object" || Array.isArray(rawDocument)) {
      throw new Error(`registry ${appId} metadata 必须是对象。`);
    }
    const candidate = rawDocument as Record<string, unknown>;
    const name = this.readRequiredString(candidate.name, "name");
    if (name !== appId) {
      throw new Error(`registry 返回的包名与请求不一致：请求 ${appId}，收到 ${name}`);
    }
    const distTags = candidate["dist-tags"];
    if (!distTags || typeof distTags !== "object" || Array.isArray(distTags)) {
      throw new Error("registry metadata 缺少 dist-tags。");
    }
    const versions = candidate.versions;
    if (!versions || typeof versions !== "object" || Array.isArray(versions)) {
      throw new Error("registry metadata 缺少 versions。");
    }
    return {
      name,
      description: this.readOptionalString(candidate.description, "description"),
      "dist-tags": {
        latest: this.readRequiredString(
          (distTags as Record<string, unknown>).latest,
          "dist-tags.latest",
        ),
      },
      versions: Object.fromEntries(
        Object.entries(versions).map(([version, rawVersion]) => [
          version,
          this.parseVersion(rawVersion, name, version),
        ]),
      ),
    };
  };

  private parseVersion = (
    rawVersion: unknown,
    appId: string,
    version: string,
  ): AppRemoteRegistryVersion => {
    if (!rawVersion || typeof rawVersion !== "object" || Array.isArray(rawVersion)) {
      throw new Error(`registry metadata 的 versions.${version} 必须是对象。`);
    }
    const candidate = rawVersion as Record<string, unknown>;
    const name = this.readRequiredString(candidate.name, `versions.${version}.name`);
    const parsedVersion = this.readRequiredString(
      candidate.version,
      `versions.${version}.version`,
    );
    if (name !== appId || parsedVersion !== version) {
      throw new Error(`registry metadata 的 versions.${version} 与 app id/version 不一致。`);
    }
    const dist = candidate.dist;
    if (!dist || typeof dist !== "object" || Array.isArray(dist)) {
      throw new Error(`registry metadata 的 versions.${version}.dist 必须是对象。`);
    }
    const distCandidate = dist as Record<string, unknown>;
    return {
      name,
      version: parsedVersion,
      description: this.readOptionalString(
        candidate.description,
        `versions.${version}.description`,
      ),
      publisher: this.parsePublisher(candidate.publisher, version),
      permissions: candidate.permissions as AppRemoteRegistryVersion["permissions"],
      dist: {
        kind:
          distCandidate.kind === "source" || distCandidate.kind === "bundle"
            ? distCandidate.kind
            : undefined,
        artifact: this.readOptionalString(
          distCandidate.artifact,
          `versions.${version}.dist.artifact`,
        ),
        bundle: this.readRequiredString(
          distCandidate.bundle,
          `versions.${version}.dist.bundle`,
        ),
        source: this.readOptionalString(
          distCandidate.source,
          `versions.${version}.dist.source`,
        ),
        sha256: this.readRequiredString(
          distCandidate.sha256,
          `versions.${version}.dist.sha256`,
        ),
      },
    };
  };

  private parsePublisher = (
    rawPublisher: unknown,
    version: string,
  ): AppRemoteRegistryVersion["publisher"] => {
    if (rawPublisher === undefined) {
      return undefined;
    }
    if (!rawPublisher || typeof rawPublisher !== "object" || Array.isArray(rawPublisher)) {
      throw new Error(`versions.${version}.publisher 必须是对象。`);
    }
    const candidate = rawPublisher as Record<string, unknown>;
    return {
      id: this.readRequiredString(candidate.id, `versions.${version}.publisher.id`),
      name: this.readRequiredString(candidate.name, `versions.${version}.publisher.name`),
      url: this.readOptionalString(candidate.url, `versions.${version}.publisher.url`),
    };
  };

  private readRequiredString = (value: unknown, fieldName: string): string => {
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`${fieldName} 必须是非空字符串。`);
    }
    return value.trim();
  };

  private readOptionalString = (
    value: unknown,
    fieldName: string,
  ): string | undefined => {
    if (value === undefined) {
      return undefined;
    }
    return this.readRequiredString(value, fieldName);
  };

  private normalizeBundleFileName = (appId: string): string => {
    return appId.replace(/[^a-zA-Z0-9._-]+/g, "-");
  };

  private normalizeRegistryUrl = (registryUrl: string): string => {
    let normalized: URL;
    try {
      normalized = new URL(registryUrl);
    } catch {
      throw new Error(`非法 registry URL：${registryUrl}`);
    }
    if (normalized.protocol !== "http:" && normalized.protocol !== "https:") {
      throw new Error(`registry URL 只支持 http/https：${registryUrl}`);
    }
    const text = normalized.toString();
    return text.endsWith("/") ? text : `${text}/`;
  };
}
