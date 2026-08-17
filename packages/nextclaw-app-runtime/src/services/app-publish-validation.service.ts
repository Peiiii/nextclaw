import { stat } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { AppBundleService } from "#app-runtime/services/app-bundle.service.js";
import type { AppDistributionMode } from "#app-runtime/types/app-bundle.types.js";
import { AppManifestService } from "#app-runtime/services/app-manifest.service.js";
import type { AppArtifactTarget } from "#app-runtime/types/app-manifest.types.js";
import {
  isAppComponentManifestBundle,
  isAppStandaloneManifestBundle,
} from "#app-runtime/types/app-manifest.types.js";
import { AppMarketplaceMetadataService } from "./app-marketplace-metadata.service.js";
import { AppPlatformTargetService } from "./app-platform-target.service.js";
import { AppPublishArtifactService } from "./app-publish-artifact.service.js";

const MAIN_ENTRY_WARN_BYTES = 10 * 1024 * 1024;
const BUNDLE_WARN_BYTES = 5 * 1024 * 1024;

export type AppPublishValidationWarningCode =
  | "main-entry-large"
  | "bundle-large";

export type AppPublishValidationWarning = {
  code: AppPublishValidationWarningCode;
  message: string;
};

export type AppPublishValidationResult = {
  ok: boolean;
  appDirectory: string;
  metadataPath: string;
  appId: string;
  version: string;
  distributionMode: AppDistributionMode;
  profile: "standalone" | "components";
  mainKind?: string;
  mainEntryPath?: string;
  mainEntrySizeBytes?: number;
  componentCount?: number;
  bundleSizeBytes: number;
  bundleFilePaths: string[];
  artifacts?: Array<{
    target: AppArtifactTarget;
    targetKey: string;
    path: string;
    sha256: string;
    sizeBytes: number;
    filePaths: string[];
  }>;
  warnings: AppPublishValidationWarning[];
};

export class AppPublishValidationService {
  constructor(
    private readonly manifestService: AppManifestService = new AppManifestService(),
    private readonly metadataService: AppMarketplaceMetadataService = new AppMarketplaceMetadataService(),
    private readonly bundleService: AppBundleService = new AppBundleService(),
    private readonly publishArtifactService: AppPublishArtifactService = new AppPublishArtifactService(),
    private readonly platformTargetService: AppPlatformTargetService = new AppPlatformTargetService(),
  ) {}

  validate = async (params: {
    appDirectory: string;
    metadataPath?: string;
    mode?: AppDistributionMode;
    artifactsDirectory?: string;
  }): Promise<AppPublishValidationResult> => {
    const {
      appDirectory: inputAppDirectory,
      metadataPath: inputMetadataPath,
      mode,
    } = params;
    const appDirectory = path.resolve(inputAppDirectory);
    const bundle = await this.manifestService.load(appDirectory);
    const distributionMode = mode ??
      (bundle.manifest.schemaVersion === 2 ? "bundle" : "source");
    const metadataPath = inputMetadataPath
      ? path.resolve(inputMetadataPath)
      : path.join(appDirectory, "marketplace.json");
    await this.metadataService.load({
      appDirectory,
      manifest: bundle.manifest,
      metadataPath,
    });
    const distribution = bundle.manifest.schemaVersion === 2
      ? this.platformTargetService.resolveDistribution(bundle.manifest.distribution)
      : { mode: "universal" as const };
    if (distribution.mode === "targeted") {
      if (!params.artifactsDirectory?.trim()) {
        throw new Error("targeted App 发布校验需要通过 --artifacts 指定平台 artifact 目录。");
      }
      if (!isAppComponentManifestBundle(bundle)) {
        throw new Error("只有 schema v2 component App 支持 targeted artifacts。");
      }
      const artifacts = await this.publishArtifactService.collect({
        manifest: bundle.manifest,
        artifactsDirectory: params.artifactsDirectory,
      });
      const bundleSizeBytes = artifacts.reduce(
        (total, artifact) => total + artifact.sizeBytes,
        0,
      );
      const warnings = artifacts.flatMap((artifact) =>
        this.buildWarnings({ bundleSizeBytes: artifact.sizeBytes }).map((warning) => ({
          ...warning,
          message: `${artifact.targetKey}: ${warning.message}`,
        })),
      );
      return {
        ok: true,
        appDirectory,
        metadataPath,
        appId: bundle.manifest.id,
        version: bundle.manifest.version,
        distributionMode,
        profile: "components",
        componentCount: bundle.components.length,
        bundleSizeBytes,
        bundleFilePaths: [],
        artifacts: artifacts.map((artifact) => ({
          target: artifact.target,
          targetKey: artifact.targetKey,
          path: artifact.bundlePath,
          sha256: artifact.sha256,
          sizeBytes: artifact.sizeBytes,
          filePaths: artifact.filePaths,
        })),
        warnings,
      };
    }

    const tempDirectory = await mkdtemp(path.join(tmpdir(), "napp-validate-publish-"));
    try {
      const packResult = await this.bundleService.packAppDirectory({
        appDirectory,
        outputPath: path.join(tempDirectory, `${bundle.manifest.id}-${bundle.manifest.version}.napp`),
        mode: distributionMode,
      });
      const standaloneBundle = isAppStandaloneManifestBundle(bundle) ? bundle : undefined;
      const mainEntryStats = standaloneBundle
        ? await stat(standaloneBundle.mainEntryPath)
        : undefined;
      const warnings = this.buildWarnings({
        mainEntrySizeBytes: mainEntryStats?.size,
        bundleSizeBytes: packResult.sizeBytes,
      });
      return {
        ok: true,
        appDirectory,
        metadataPath,
        appId: bundle.manifest.id,
        version: bundle.manifest.version,
        distributionMode,
        profile: standaloneBundle ? "standalone" : "components",
        mainKind: standaloneBundle?.manifest.main.kind,
        mainEntryPath: standaloneBundle?.mainEntryPath,
        mainEntrySizeBytes: mainEntryStats?.size,
        componentCount: isAppComponentManifestBundle(bundle)
          ? bundle.components.length
          : undefined,
        bundleSizeBytes: packResult.sizeBytes,
        bundleFilePaths: packResult.filePaths,
        warnings,
      };
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  };

  private buildWarnings = (params: {
    mainEntrySizeBytes?: number;
    bundleSizeBytes: number;
  }): AppPublishValidationWarning[] => {
    const { bundleSizeBytes, mainEntrySizeBytes } = params;
    const warnings: AppPublishValidationWarning[] = [];
    if (mainEntrySizeBytes !== undefined && mainEntrySizeBytes > MAIN_ENTRY_WARN_BYTES) {
      warnings.push({
        code: "main-entry-large",
        message: `main entry is ${this.formatBytes(mainEntrySizeBytes)}, which is larger than the ${this.formatBytes(MAIN_ENTRY_WARN_BYTES)} warning threshold.`,
      });
    }
    if (bundleSizeBytes > BUNDLE_WARN_BYTES) {
      warnings.push({
        code: "bundle-large",
        message: `packed .napp is ${this.formatBytes(bundleSizeBytes)}, which is larger than the ${this.formatBytes(BUNDLE_WARN_BYTES)} warning threshold.`,
      });
    }
    return warnings;
  };

  private formatBytes = (value: number): string => {
    if (value < 1024) {
      return `${value} B`;
    }
    if (value < 1024 * 1024) {
      return `${(value / 1024).toFixed(1)} KB`;
    }
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  };
}
