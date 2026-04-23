import { stat } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { AppBundleService } from "../bundle/app-bundle.service.js";
import type { AppDistributionMode } from "../bundle/app-bundle.types.js";
import { AppManifestService } from "../manifest/app-manifest.service.js";
import { AppMarketplaceMetadataService } from "./app-marketplace-metadata.service.js";

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
  mainKind: string;
  mainEntryPath: string;
  mainEntrySizeBytes: number;
  bundleSizeBytes: number;
  bundleFilePaths: string[];
  warnings: AppPublishValidationWarning[];
};

export class AppPublishValidationService {
  constructor(
    private readonly manifestService: AppManifestService = new AppManifestService(),
    private readonly metadataService: AppMarketplaceMetadataService = new AppMarketplaceMetadataService(),
    private readonly bundleService: AppBundleService = new AppBundleService(),
  ) {}

  validate = async (params: {
    appDirectory: string;
    metadataPath?: string;
    mode?: AppDistributionMode;
  }): Promise<AppPublishValidationResult> => {
    const {
      appDirectory: inputAppDirectory,
      metadataPath: inputMetadataPath,
      mode,
    } = params;
    const appDirectory = path.resolve(inputAppDirectory);
    const distributionMode = mode ?? "source";
    const bundle = await this.manifestService.load(appDirectory);
    const metadataPath = inputMetadataPath
      ? path.resolve(inputMetadataPath)
      : path.join(appDirectory, "marketplace.json");
    await this.metadataService.load({
      appDirectory,
      manifest: bundle.manifest,
      metadataPath,
    });

    const tempDirectory = await mkdtemp(path.join(tmpdir(), "napp-validate-publish-"));
    try {
      const packResult = await this.bundleService.packAppDirectory({
        appDirectory,
        outputPath: path.join(tempDirectory, `${bundle.manifest.id}-${bundle.manifest.version}.napp`),
        mode: distributionMode,
      });
      const mainEntryStats = await stat(bundle.mainEntryPath);
      const warnings = this.buildWarnings({
        mainEntrySizeBytes: mainEntryStats.size,
        bundleSizeBytes: packResult.sizeBytes,
      });
      return {
        ok: true,
        appDirectory,
        metadataPath,
        appId: bundle.manifest.id,
        version: bundle.manifest.version,
        distributionMode,
        mainKind: bundle.manifest.main.kind,
        mainEntryPath: bundle.mainEntryPath,
        mainEntrySizeBytes: mainEntryStats.size,
        bundleSizeBytes: packResult.sizeBytes,
        bundleFilePaths: packResult.filePaths,
        warnings,
      };
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  };

  private buildWarnings = (params: {
    mainEntrySizeBytes: number;
    bundleSizeBytes: number;
  }): AppPublishValidationWarning[] => {
    const { bundleSizeBytes, mainEntrySizeBytes } = params;
    const warnings: AppPublishValidationWarning[] = [];
    if (mainEntrySizeBytes > MAIN_ENTRY_WARN_BYTES) {
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
