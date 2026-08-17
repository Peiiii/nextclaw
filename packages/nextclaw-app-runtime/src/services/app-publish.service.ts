import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { AppBundleService } from "#app-runtime/services/app-bundle.service.js";
import type { AppDistributionMode } from "#app-runtime/types/app-bundle.types.js";
import { AppManifestService } from "#app-runtime/services/app-manifest.service.js";
import { AppMarketplaceClientService } from "./app-marketplace-client.service.js";
import { AppMarketplaceMetadataService } from "./app-marketplace-metadata.service.js";
import { AppPlatformTargetService } from "./app-platform-target.service.js";
import { AppPublishArtifactService } from "./app-publish-artifact.service.js";
import type { AppPublishPayload, AppPublishResult } from "#app-runtime/types/app-publish.types.js";
import { PlatformAuthStateService } from "./platform-auth-state.service.js";

const DEFAULT_PLATFORM_API_BASE = "https://ai-gateway-api.nextclaw.io";

type ResolvedPublishActor = {
  token: string;
  publisher: NonNullable<AppPublishPayload["publisher"]>;
};

export class AppPublishService {
  constructor(
    private readonly manifestService: AppManifestService = new AppManifestService(),
    private readonly bundleService: AppBundleService = new AppBundleService(),
    private readonly metadataService: AppMarketplaceMetadataService = new AppMarketplaceMetadataService(),
    private readonly marketplaceClient: AppMarketplaceClientService = new AppMarketplaceClientService(),
    private readonly authStateService: PlatformAuthStateService = new PlatformAuthStateService(),
    private readonly publishArtifactService: AppPublishArtifactService = new AppPublishArtifactService(),
    private readonly platformTargetService: AppPlatformTargetService = new AppPlatformTargetService(),
  ) {}

  publish = async (params: {
    appDirectory: string;
    metadataPath?: string;
    bundleOutputPath?: string;
    apiBaseUrl?: string;
    token?: string;
    mode?: AppDistributionMode;
    artifactsDirectory?: string;
  }): Promise<AppPublishResult> => {
    const {
      appDirectory: inputAppDirectory,
      metadataPath,
      bundleOutputPath,
      apiBaseUrl,
      token,
    } = params;
    const appDirectory = path.resolve(inputAppDirectory);
    const manifestBundle = await this.manifestService.load(appDirectory);
    const distributionMode = params.mode ??
      (manifestBundle.manifest.schemaVersion === 2 ? "bundle" : "source");
    const metadata = await this.metadataService.load({
      appDirectory,
      manifest: manifestBundle.manifest,
      metadataPath,
    });
    const actor = await this.resolvePublishActor({
      apiBaseUrl,
      explicitToken: token,
      appId: manifestBundle.manifest.id,
    });
    const componentManifest = manifestBundle.manifest.schemaVersion === 2
      ? manifestBundle.manifest
      : undefined;
    const distribution = componentManifest
      ? this.platformTargetService.resolveDistribution(
          componentManifest.distribution,
        )
      : { mode: "universal" as const };
    if (distribution.mode === "targeted" && !params.artifactsDirectory?.trim()) {
      throw new Error("targeted App 发布需要通过 --artifacts 指定平台 artifact 目录。");
    }
    const preparedArtifacts = distribution.mode === "targeted" && componentManifest
      ? await this.publishArtifactService.collect({
          manifest: componentManifest,
          artifactsDirectory: params.artifactsDirectory!,
        })
      : [];
    const bundle = distribution.mode === "universal"
      ? await this.bundleService.packAppDirectory({
          appDirectory,
          outputPath: bundleOutputPath,
          mode: distributionMode,
        })
      : undefined;
    const bundleBytes = bundle
      ? Buffer.from(await readFile(bundle.bundlePath))
      : undefined;
    const bundleSha256 = bundleBytes
      ? createHash("sha256").update(bundleBytes).digest("hex")
      : undefined;
    const publishFiles = await this.metadataService.collectPublishFiles({
      appDirectory,
      iconPath: manifestBundle.manifest.icon,
      metadataPath,
      visuals: metadata.visuals,
    });
    const payloadBase = {
      slug: metadata.slug,
      appId: manifestBundle.manifest.id,
      name: manifestBundle.manifest.name,
      version: manifestBundle.manifest.version,
      summary: metadata.summary,
      summaryI18n: metadata.summaryI18n,
      description: metadata.description ?? manifestBundle.manifest.description,
      descriptionI18n: metadata.descriptionI18n,
      author: metadata.author,
      tags: metadata.tags,
      sourceRepo: metadata.sourceRepo,
      homepage: metadata.homepage,
      featured: metadata.featured ?? false,
      publisher: actor.publisher,
      visuals: metadata.visuals,
      distributionMode,
      manifest: manifestBundle.manifest,
      permissions: manifestBundle.manifest.schemaVersion === 1
        ? manifestBundle.manifest.permissions ?? {}
        : this.manifestService.resolvePlatformSecurity(manifestBundle.manifest).permissions,
      files: publishFiles.map((file) => ({
        path: file.path,
        contentBase64: file.bytes.toString("base64"),
      })),
    };
    const payload: AppPublishPayload = bundleBytes && bundleSha256
      ? {
          ...payloadBase,
          bundleBase64: bundleBytes.toString("base64"),
          bundleSha256,
        }
      : {
          ...payloadBase,
          artifacts: preparedArtifacts.map((artifact) => ({
            target: artifact.target,
            bundleBase64: artifact.bytes.toString("base64"),
            bundleSha256: artifact.sha256,
            sizeBytes: artifact.sizeBytes,
          })),
        };
    const result = await this.marketplaceClient.publish({
      payload,
      apiBaseUrl,
      token: actor.token,
    });
    return {
      ...result,
      distribution: {
        mode: distributionMode,
        ...(bundle && bundleSha256
          ? {
              path: bundle.bundlePath,
              sha256: bundleSha256,
            }
          : {
              path: path.resolve(params.artifactsDirectory!),
              artifacts: preparedArtifacts.map((artifact) => ({
                target: artifact.target,
                path: artifact.bundlePath,
                sha256: artifact.sha256,
                sizeBytes: artifact.sizeBytes,
              })),
            }),
      },
    };
  };

  private resolvePublishActor = async (params: {
    apiBaseUrl?: string;
    explicitToken?: string;
    appId: string;
  }): Promise<ResolvedPublishActor> => {
    const explicitToken = params.explicitToken?.trim();
    const envAdminToken = process.env.NEXTCLAW_MARKETPLACE_ADMIN_TOKEN?.trim();
    if (explicitToken) {
      const token = explicitToken;
      if (!token) {
        throw new Error("缺少 publish token。");
      }
      const me = await this.fetchCurrentPlatformUser({
        token,
        platformApiBase: this.resolvePlatformApiBase(),
      });
      return {
        token,
        publisher: this.buildUserPublisher(me, params.appId),
      };
    }

    const authState = this.authStateService.readCurrentAuthState();
    const platformToken = authState.token?.trim();
    if (platformToken) {
      const me = await this.fetchCurrentPlatformUser({
        token: platformToken,
        platformApiBase: this.resolvePlatformApiBase(authState.apiBaseUrl),
      });
      return {
        token: platformToken,
        publisher: this.buildUserPublisher(me, params.appId),
      };
    }

    if (envAdminToken) {
      return {
        token: envAdminToken,
        publisher: this.buildOfficialPublisher(),
      };
    }

    throw new Error("发布需要 NextClaw 平台登录态。请先运行 nextclaw login，或传入 --token。");
  };

  private fetchCurrentPlatformUser = async (params: {
    token: string;
    platformApiBase: string;
  }): Promise<{
    id: string;
    username: string | null;
    role: "admin" | "user";
  }> => {
    const response = await fetch(`${params.platformApiBase}/platform/auth/me`, {
      headers: {
        authorization: `Bearer ${params.token}`,
        accept: "application/json",
      },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        typeof payload === "object" &&
        payload &&
        "error" in payload &&
        typeof (payload as { error?: { message?: unknown } }).error?.message === "string"
          ? (payload as { error: { message: string } }).error.message
          : `${response.status} ${response.statusText}`;
      throw new Error(`读取 NextClaw 登录态失败：${message}`);
    }
    const user = typeof payload === "object" &&
      payload &&
      "data" in payload &&
      typeof (payload as { data?: { user?: unknown } }).data?.user === "object" &&
      (payload as { data: { user: Record<string, unknown> } }).data.user
      ? (payload as { data: { user: Record<string, unknown> } }).data.user
      : null;
    const id = typeof user?.id === "string" ? user.id.trim() : "";
    const username = typeof user?.username === "string" ? user.username.trim() : "";
    const role = user?.role === "admin" ? "admin" : "user";
    if (!id) {
      throw new Error("平台登录态缺少用户 id。");
    }
    return {
      id,
      username: username || null,
      role,
    };
  };

  private resolvePlatformApiBase = (configuredApiBase?: string): string => {
    const source = configuredApiBase?.trim() || process.env.NEXTCLAW_PLATFORM_API_BASE?.trim() || DEFAULT_PLATFORM_API_BASE;
    const normalized = new URL(source);
    normalized.pathname = normalized.pathname.replace(/\/v1\/?$/, "/");
    return normalized.toString().replace(/\/+$/, "");
  };

  private buildUserPublisher = (
    user: { id: string; username: string | null; role: "admin" | "user" },
    appId: string,
  ): NonNullable<AppPublishPayload["publisher"]> => {
    const isOfficialScope = appId.startsWith("nextclaw.");
    if (isOfficialScope && user.role === "admin") {
      return this.buildOfficialPublisher();
    }
    if (!user.username) {
      throw new Error("当前 NextClaw 账号还没有 username，无法发布个人 scope app。请先在平台账号页设置用户名。");
    }
    return {
      id: user.username,
      name: user.username,
      url: `https://platform.nextclaw.io/account`,
    };
  };

  private buildOfficialPublisher = (): NonNullable<AppPublishPayload["publisher"]> => {
    return {
      id: "nextclaw",
      name: "NextClaw",
      url: "https://nextclaw.io",
    };
  };
}
