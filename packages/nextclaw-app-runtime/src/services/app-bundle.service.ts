import { createHash, randomUUID } from "node:crypto";
import { access, lstat, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { strToU8, unzipSync, zipSync } from "fflate";
import { AppManifestService } from "#app-runtime/services/app-manifest.service.js";
import {
  isAppComponentManifestBundle,
  isAppStandaloneManifestBundle,
  type AppManifestBundle,
} from "#app-runtime/types/app-manifest.types.js";
import type {
  AppBundleChecksums,
  AppBundleExtractResult,
  AppBundleMetadata,
  AppBundlePackResult,
  AppDistributionMode,
} from "#app-runtime/types/app-bundle.types.js";

const MAX_COMPRESSED_BYTES = 25 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_FILE_COUNT = 2_000;
const CHECKSUMS_PATH = ".napp/checksums.json";
const BUNDLE_METADATA_PATH = ".napp/bundle.json";

export class AppBundleService {
  constructor(
    private readonly manifestService: AppManifestService = new AppManifestService(),
  ) {}

  packAppDirectory = async (params: {
    appDirectory: string;
    outputPath?: string;
    mode?: AppDistributionMode;
  }): Promise<AppBundlePackResult> => {
    const { appDirectory, outputPath, mode: requestedMode } = params;
    const bundle = await this.manifestService.load(appDirectory);
    const mode = requestedMode ?? "bundle";
    if (isAppComponentManifestBundle(bundle) && mode !== "bundle") {
      throw new Error("schema v2 组合包只支持 bundle 分发，不允许运行安装脚本。");
    }
    const { appFiles, filePaths } = mode === "source"
      ? await this.collectSourceFiles(bundle)
      : await this.collectRuntimeFiles(bundle);
    this.assertFileBudgets(appFiles);
    const metadata = this.buildMetadata(
      bundle.manifest.id,
      bundle.manifest.name,
      bundle.manifest.version,
      mode,
    );
    const bundleJsonBytes = strToU8(`${JSON.stringify(metadata, null, 2)}\n`);
    const checksums = this.buildChecksums({
      ...appFiles,
      [BUNDLE_METADATA_PATH]: bundleJsonBytes,
    });
    const checksumsJsonBytes = strToU8(`${JSON.stringify(checksums, null, 2)}\n`);
    const archiveBytes = zipSync(
      {
        ...appFiles,
        [BUNDLE_METADATA_PATH]: bundleJsonBytes,
        [CHECKSUMS_PATH]: checksumsJsonBytes,
      },
      { level: 9 },
    );
    if (archiveBytes.byteLength > MAX_COMPRESSED_BYTES) {
      throw new Error(`bundle 压缩后超过 ${MAX_COMPRESSED_BYTES} bytes 上限。`);
    }
    const resolvedOutputPath = outputPath
      ? path.resolve(outputPath)
      : path.join(
          path.dirname(bundle.appDirectory),
          `${this.normalizeBundleFileName(bundle.manifest.id)}-${bundle.manifest.version}.napp`,
        );
    await mkdir(path.dirname(resolvedOutputPath), { recursive: true });
    await writeFile(resolvedOutputPath, Buffer.from(archiveBytes));
    return {
      bundlePath: resolvedOutputPath,
      metadata,
      sizeBytes: archiveBytes.byteLength,
      filePaths,
    };
  };

  extractBundle = async (params: {
    bundlePath: string;
    targetDirectory: string;
  }): Promise<AppBundleExtractResult> => {
    const bundlePath = path.resolve(params.bundlePath);
    const targetDirectory = path.resolve(params.targetDirectory);
    const { archive, metadata, checksums } = await this.readValidatedArchive(bundlePath);
    await this.replaceTargetWithArchive({ archive, metadata, targetDirectory });
    return { appDirectory: targetDirectory, metadata, checksums };
  };

  private readValidatedArchive = async (bundlePath: string): Promise<{
    archive: Record<string, Uint8Array>;
    metadata: AppBundleMetadata;
    checksums: AppBundleChecksums;
  }> => {
    const bundleStats = await stat(bundlePath);
    if (!bundleStats.isFile() || bundleStats.size > MAX_COMPRESSED_BYTES) {
      throw new Error(`bundle 压缩体积超过 ${MAX_COMPRESSED_BYTES} bytes 上限。`);
    }
    let fileCount = 0;
    let totalBytes = 0;
    const archive = unzipSync(new Uint8Array(await readFile(bundlePath)), {
      filter: (file) => {
        fileCount += 1;
        totalBytes += file.originalSize;
        if (fileCount > MAX_FILE_COUNT) {
          throw new Error(`bundle 文件数超过 ${MAX_FILE_COUNT} 上限。`);
        }
        if (file.originalSize > MAX_FILE_BYTES) {
          throw new Error(`bundle 单文件超过 ${MAX_FILE_BYTES} bytes 上限：${file.name}`);
        }
        if (totalBytes > MAX_UNCOMPRESSED_BYTES) {
          throw new Error(`bundle 解压后超过 ${MAX_UNCOMPRESSED_BYTES} bytes 上限。`);
        }
        return true;
      },
    });
    const normalizedArchive = this.normalizeArchive(archive);
    const metadata = this.readMetadataFromArchive(normalizedArchive);
    const checksums = this.readChecksumsFromArchive(normalizedArchive);
    this.verifyArchiveChecksums(normalizedArchive, checksums);
    return { archive: normalizedArchive, metadata, checksums };
  };

  private replaceTargetWithArchive = async (params: {
    archive: Record<string, Uint8Array>;
    metadata: AppBundleMetadata;
    targetDirectory: string;
  }): Promise<void> => {
    const { archive, metadata, targetDirectory } = params;
    const targetParent = path.dirname(targetDirectory);
    const operationId = randomUUID();
    const stagedDirectory = path.join(
      targetParent,
      `.${path.basename(targetDirectory)}.extracting-${operationId}`,
    );
    const backupDirectory = path.join(
      targetParent,
      `.${path.basename(targetDirectory)}.backup-${operationId}`,
    );
    const targetExists = await this.pathExists(targetDirectory);
    await mkdir(targetParent, { recursive: true });
    try {
      await mkdir(stagedDirectory);
      await this.writeArchiveEntries(archive, stagedDirectory);
      await this.assertExtractedManifest(stagedDirectory, metadata);
      if (targetExists) {
        await rename(targetDirectory, backupDirectory);
      }
      await rename(stagedDirectory, targetDirectory);
      await rm(backupDirectory, { recursive: true, force: true });
    } catch (error) {
      await rm(stagedDirectory, { recursive: true, force: true });
      if (targetExists && await this.pathExists(backupDirectory)) {
        await rm(targetDirectory, { recursive: true, force: true });
        try {
          await rename(backupDirectory, targetDirectory);
        } catch (restoreError) {
          throw new AggregateError(
            [error, restoreError],
            `bundle 解压失败，且无法恢复原目标目录：${targetDirectory}`,
          );
        }
      }
      throw error;
    } finally {
      await rm(stagedDirectory, { recursive: true, force: true });
      await rm(backupDirectory, { recursive: true, force: true });
    }
  };

  private writeArchiveEntries = async (
    archive: Record<string, Uint8Array>,
    targetDirectory: string,
  ): Promise<void> => {
    for (const [entryName, bytes] of Object.entries(archive)) {
      const targetPath = path.join(targetDirectory, entryName);
      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, Buffer.from(bytes));
    }
  };

  private assertExtractedManifest = async (
    appDirectory: string,
    metadata: AppBundleMetadata,
  ): Promise<void> => {
    const manifestBundle = await this.manifestService.load(appDirectory);
    if (
      metadata.appId !== manifestBundle.manifest.id ||
      metadata.name !== manifestBundle.manifest.name ||
      metadata.version !== manifestBundle.manifest.version
    ) {
      throw new Error("bundle metadata 与 manifest.json 身份不一致。");
    }
    if (manifestBundle.manifest.schemaVersion === 2 && metadata.distributionMode !== "bundle") {
      throw new Error("schema v2 组合包只支持 bundle 分发。");
    }
  };

  private collectRuntimeFiles = async (
    bundle: AppManifestBundle,
  ): Promise<{ appFiles: Record<string, Uint8Array>; filePaths: string[] }> => {
    const filePaths = new Set<string>([
      path.relative(bundle.appDirectory, bundle.manifestPath).replace(/\\/g, "/"),
    ]);
    if (isAppStandaloneManifestBundle(bundle)) {
      filePaths.add(path.relative(bundle.appDirectory, bundle.mainEntryPath).replace(/\\/g, "/"));
      await this.collectDirectoryPaths(bundle.uiDirectoryPath, bundle.appDirectory, filePaths);
      await this.collectDirectoryPaths(bundle.assetsDirectoryPath, bundle.appDirectory, filePaths);
    } else {
      for (const component of bundle.components) {
        await this.collectDirectoryPaths(component.componentDirectory, bundle.appDirectory, filePaths);
      }
      await this.collectDirectoryPaths(bundle.assetsDirectoryPath, bundle.appDirectory, filePaths);
      await this.addOptionalFile(bundle.appDirectory, "marketplace.json", filePaths);
    }
    if (bundle.iconPath) {
      filePaths.add(path.relative(bundle.appDirectory, bundle.iconPath).replace(/\\/g, "/"));
    }
    return await this.readAppFiles(bundle.appDirectory, filePaths);
  };

  private collectSourceFiles = async (
    bundle: AppManifestBundle,
  ): Promise<{ appFiles: Record<string, Uint8Array>; filePaths: string[] }> => {
    if (!isAppStandaloneManifestBundle(bundle)) {
      throw new Error("schema v2 组合包不支持 source 分发。");
    }
    const filePaths = new Set<string>();
    await this.collectSourceDirectoryPaths(bundle.appDirectory, bundle.appDirectory, filePaths);
    const result = await this.readAppFiles(bundle.appDirectory, filePaths);
    if (bundle.manifest.main.kind === "wasi-http-component") {
      result.appFiles[bundle.manifest.main.entry] = SOURCE_WASM_PLACEHOLDER_BYTES;
    }
    return result;
  };

  private readAppFiles = async (
    appDirectory: string,
    filePaths: Set<string>,
  ): Promise<{ appFiles: Record<string, Uint8Array>; filePaths: string[] }> => {
    const sortedPaths = Array.from(filePaths).sort((left, right) => left.localeCompare(right));
    const appFiles: Record<string, Uint8Array> = {};
    for (const relativePath of sortedPaths) {
      appFiles[relativePath] = new Uint8Array(await readFile(path.join(appDirectory, relativePath)));
    }
    return { appFiles, filePaths: sortedPaths };
  };

  private collectDirectoryPaths = async (
    directoryPath: string,
    appDirectory: string,
    filePaths: Set<string>,
  ): Promise<void> => {
    try {
      const entries = await readdir(directoryPath, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = path.join(directoryPath, entry.name);
        const relativePath = path.relative(appDirectory, entryPath).replace(/\\/g, "/");
        const entryStats = await lstat(entryPath);
        if (entryStats.isSymbolicLink()) {
          throw new Error(`bundle 不允许包含符号链接：${relativePath}`);
        }
        if (entry.isDirectory()) {
          if (!this.shouldExcludeRuntimePath(relativePath)) {
            await this.collectDirectoryPaths(entryPath, appDirectory, filePaths);
          }
          continue;
        }
        if (entry.isFile() && !this.shouldExcludeRuntimePath(relativePath)) {
          filePaths.add(relativePath);
        }
      }
    } catch (error) {
      if (this.isMissingFileError(error)) {
        return;
      }
      throw error;
    }
  };

  private collectSourceDirectoryPaths = async (
    directoryPath: string,
    appDirectory: string,
    filePaths: Set<string>,
  ): Promise<void> => {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(directoryPath, entry.name);
      const relativePath = path.relative(appDirectory, entryPath).replace(/\\/g, "/");
      const entryStats = await lstat(entryPath);
      if (entryStats.isSymbolicLink()) {
        throw new Error(`bundle 不允许包含符号链接：${relativePath}`);
      }
      if (entry.isDirectory()) {
        if (!this.shouldExcludeSourcePath(relativePath)) {
          await this.collectSourceDirectoryPaths(entryPath, appDirectory, filePaths);
        }
      } else if (entry.isFile() && !this.shouldExcludeSourcePath(relativePath)) {
        filePaths.add(relativePath);
      }
    }
  };

  private addOptionalFile = async (
    appDirectory: string,
    relativePath: string,
    filePaths: Set<string>,
  ): Promise<void> => {
    try {
      const stats = await lstat(path.join(appDirectory, relativePath));
      if (stats.isFile() && !stats.isSymbolicLink()) {
        filePaths.add(relativePath);
      }
    } catch (error) {
      if (!this.isMissingFileError(error)) {
        throw error;
      }
    }
  };

  private shouldExcludeRuntimePath = (relativePath: string): boolean => {
    const segments = relativePath.split("/");
    return segments.some((segment) =>
      segment === "node_modules" ||
      segment === ".git" ||
      segment === "coverage" ||
      segment === "tests" ||
      segment === "__tests__" ||
      segment === "fixtures"
    ) || /(?:^|\/)\.(?:DS_Store|eslintcache)$/.test(relativePath) || relativePath.endsWith(".map");
  };

  private shouldExcludeSourcePath = (relativePath: string): boolean => {
    return this.shouldExcludeRuntimePath(relativePath) ||
      relativePath === ".napp" || relativePath.startsWith(".napp/") ||
      relativePath === "main/dist" || relativePath.startsWith("main/dist/") ||
      relativePath === "main/generated" || relativePath.startsWith("main/generated/");
  };

  private assertFileBudgets = (files: Record<string, Uint8Array>): void => {
    const entries = Object.entries(files);
    if (entries.length + 2 > MAX_FILE_COUNT) {
      throw new Error(`bundle 文件数超过 ${MAX_FILE_COUNT} 上限。`);
    }
    let totalBytes = 0;
    for (const [relativePath, bytes] of entries) {
      if (bytes.byteLength > MAX_FILE_BYTES) {
        throw new Error(`bundle 单文件超过 ${MAX_FILE_BYTES} bytes 上限：${relativePath}`);
      }
      totalBytes += bytes.byteLength;
    }
    if (totalBytes > MAX_UNCOMPRESSED_BYTES) {
      throw new Error(`bundle 解压后超过 ${MAX_UNCOMPRESSED_BYTES} bytes 上限。`);
    }
  };

  private normalizeArchive = (
    archive: Record<string, Uint8Array>,
  ): Record<string, Uint8Array> => {
    const normalizedArchive: Record<string, Uint8Array> = {};
    for (const [entryName, bytes] of Object.entries(archive)) {
      const normalizedEntry = this.normalizeArchiveEntry(entryName);
      if (Object.hasOwn(normalizedArchive, normalizedEntry)) {
        throw new Error(`bundle 包含重复路径：${normalizedEntry}`);
      }
      normalizedArchive[normalizedEntry] = bytes;
    }
    return normalizedArchive;
  };

  private readMetadataFromArchive = (
    archive: Record<string, Uint8Array>,
  ): AppBundleMetadata => {
    const raw = this.readJsonArchiveEntry<Partial<AppBundleMetadata>>(
      archive,
      BUNDLE_METADATA_PATH,
      "bundle metadata",
    );
    const distributionMode = raw.distributionMode === undefined
      ? "bundle"
      : raw.distributionMode;
    if (
      raw.bundleFormatVersion !== 1 ||
      (distributionMode !== "bundle" && distributionMode !== "source") ||
      typeof raw.appId !== "string" || !raw.appId ||
      typeof raw.name !== "string" || !raw.name ||
      typeof raw.version !== "string" || !raw.version ||
      raw.entryManifest !== "manifest.json" ||
      raw.checksumsFile !== CHECKSUMS_PATH
    ) {
      throw new Error("bundle metadata 无效。");
    }
    return {
      ...raw,
      distributionMode,
    } as AppBundleMetadata;
  };

  private readChecksumsFromArchive = (
    archive: Record<string, Uint8Array>,
  ): AppBundleChecksums => {
    const raw = this.readJsonArchiveEntry<Partial<AppBundleChecksums>>(
      archive,
      CHECKSUMS_PATH,
      "bundle checksums",
    );
    if (raw.algorithm !== "sha256" || !raw.files || typeof raw.files !== "object") {
      throw new Error("bundle checksums 无效。");
    }
    return raw as AppBundleChecksums;
  };

  private verifyArchiveChecksums = (
    archive: Record<string, Uint8Array>,
    checksums: AppBundleChecksums,
  ): void => {
    const actualPaths = Object.keys(archive)
      .filter((entry) => entry !== CHECKSUMS_PATH)
      .sort((left, right) => left.localeCompare(right));
    const checksumPaths = Object.keys(checksums.files)
      .map((entry) => this.normalizeArchiveEntry(entry))
      .sort((left, right) => left.localeCompare(right));
    if (
      actualPaths.length !== checksumPaths.length ||
      actualPaths.some((entry, index) => entry !== checksumPaths[index])
    ) {
      throw new Error("bundle checksums 必须精确覆盖所有 artifact 文件。");
    }
    for (const relativePath of actualPaths) {
      const expectedHash = checksums.files[relativePath];
      if (!expectedHash || !/^[a-f0-9]{64}$/.test(expectedHash)) {
        throw new Error(`bundle checksum 格式无效：${relativePath}`);
      }
      const actualHash = this.computeSha256(archive[relativePath] as Uint8Array);
      if (actualHash !== expectedHash) {
        throw new Error(`bundle checksum 校验失败：${relativePath}`);
      }
    }
  };

  private readJsonArchiveEntry = <T>(
    archive: Record<string, Uint8Array>,
    entryPath: string,
    label: string,
  ): T => {
    const bytes = archive[entryPath];
    if (!bytes) {
      throw new Error(`bundle 缺少 ${label}。`);
    }
    try {
      return JSON.parse(Buffer.from(bytes).toString("utf-8")) as T;
    } catch (error) {
      throw new Error(`无法读取 ${label}：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  private buildMetadata = (
    appId: string,
    name: string,
    version: string,
    distributionMode: AppDistributionMode,
  ): AppBundleMetadata => ({
    bundleFormatVersion: 1,
    distributionMode,
    appId,
    name,
    version,
    entryManifest: "manifest.json",
    checksumsFile: CHECKSUMS_PATH,
  });

  private buildChecksums = (files: Record<string, Uint8Array>): AppBundleChecksums => ({
    algorithm: "sha256",
    files: Object.fromEntries(
      Object.entries(files)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([relativePath, fileBytes]) => [relativePath, this.computeSha256(fileBytes)]),
    ),
  });

  private computeSha256 = (fileBytes: Uint8Array): string =>
    createHash("sha256").update(Buffer.from(fileBytes)).digest("hex");

  private normalizeBundleFileName = (appId: string): string =>
    appId.replace(/[^a-zA-Z0-9._-]+/g, "-");

  private normalizeArchiveEntry = (entryName: string): string => {
    const normalized = entryName.replace(/\\/g, "/");
    const segments = normalized.split("/");
    if (
      !normalized || normalized.startsWith("/") || normalized.includes("\0") ||
      /^[A-Za-z]:/.test(normalized) ||
      segments.some((segment) => !segment || segment === "." || segment === "..")
    ) {
      throw new Error(`bundle 内包含非法路径：${entryName}`);
    }
    return segments.join("/");
  };

  private isMissingFileError = (error: unknown): boolean =>
    typeof error === "object" && error !== null &&
    "code" in error && (error as { code?: unknown }).code === "ENOENT";

  private pathExists = async (targetPath: string): Promise<boolean> => {
    try {
      await access(targetPath);
      return true;
    } catch {
      return false;
    }
  };
}

const SOURCE_WASM_PLACEHOLDER_BYTES = Uint8Array.from(
  Buffer.from(
    "AGFzbQEAAAABBwFgAn9/AX8DAgEABxMBD3N1bW1hcml6ZV9ub3RlcwAACg0BCwAgACABakHIAWoL",
    "base64",
  ),
);
