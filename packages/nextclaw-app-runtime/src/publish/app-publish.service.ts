import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { AppBundleService } from "../bundle/app-bundle.service.js";
import { AppManifestService } from "../manifest/app-manifest.service.js";
import { AppMarketplaceClientService } from "./app-marketplace-client.service.js";
import { AppMarketplaceMetadataService } from "./app-marketplace-metadata.service.js";
import type { AppPublishPayload, AppPublishResult } from "./app-publish.types.js";

export class AppPublishService {
  constructor(
    private readonly manifestService: AppManifestService = new AppManifestService(),
    private readonly bundleService: AppBundleService = new AppBundleService(),
    private readonly metadataService: AppMarketplaceMetadataService = new AppMarketplaceMetadataService(),
    private readonly marketplaceClient: AppMarketplaceClientService = new AppMarketplaceClientService(),
  ) {}

  publish = async (params: {
    appDirectory: string;
    metadataPath?: string;
    apiBaseUrl?: string;
    token?: string;
  }): Promise<AppPublishResult> => {
    const appDirectory = path.resolve(params.appDirectory);
    const manifestBundle = await this.manifestService.load(appDirectory);
    const metadata = await this.metadataService.load({
      appDirectory,
      manifest: manifestBundle.manifest,
      metadataPath: params.metadataPath,
    });
    const bundle = await this.bundleService.packAppDirectory({
      appDirectory,
    });
    const bundleBytes = Buffer.from(await readFile(bundle.bundlePath));
    const bundleSha256 = createHash("sha256").update(bundleBytes).digest("hex");
    const publishFiles = await this.metadataService.collectPublishFiles({
      appDirectory,
      metadataPath: params.metadataPath,
    });
    const payload: AppPublishPayload = {
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
      publisher: metadata.publisher ?? {
        id: "nextclaw",
        name: "NextClaw",
        url: "https://nextclaw.io",
      },
      manifest: manifestBundle.manifest,
      permissions: manifestBundle.manifest.permissions ?? {},
      bundleBase64: bundleBytes.toString("base64"),
      bundleSha256,
      files: publishFiles.map((file) => ({
        path: file.path,
        contentBase64: file.bytes.toString("base64"),
      })),
    };
    const result = await this.marketplaceClient.publish({
      payload,
      apiBaseUrl: params.apiBaseUrl,
      token: params.token,
    });
    return {
      ...result,
      bundle: {
        path: bundle.bundlePath,
        sha256: bundleSha256,
      },
    };
  };
}
