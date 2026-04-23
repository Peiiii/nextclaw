export type AppDistributionMode = "bundle" | "source";

export type AppBundleMetadata = {
  bundleFormatVersion: 1;
  distributionMode: AppDistributionMode;
  appId: string;
  name: string;
  version: string;
  entryManifest: "manifest.json";
  checksumsFile: ".napp/checksums.json";
};

export type AppBundleChecksums = {
  algorithm: "sha256";
  files: Record<string, string>;
};

export type AppBundlePackResult = {
  bundlePath: string;
  metadata: AppBundleMetadata;
  sizeBytes: number;
  filePaths: string[];
};

export type AppBundleExtractResult = {
  appDirectory: string;
  metadata: AppBundleMetadata;
  checksums: AppBundleChecksums;
};
