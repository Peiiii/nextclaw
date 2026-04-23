import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { unzipSync, zipSync, strToU8 } from "fflate";
import { AppManifestService } from "../manifest/app-manifest.service.js";
import type {
  AppBundleChecksums,
  AppBundleExtractResult,
  AppBundleMetadata,
  AppBundlePackResult,
  AppDistributionMode,
} from "./app-bundle.types.js";

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
    const { appFiles, filePaths } =
      mode === "source"
        ? await this.collectSourceFiles(bundle)
        : await this.collectRuntimeFiles(bundle);
    const metadata = this.buildMetadata(
      bundle.manifest.id,
      bundle.manifest.name,
      bundle.manifest.version,
      mode,
    );
    const bundleJsonPath = ".napp/bundle.json";
    const checksumsJsonPath = ".napp/checksums.json";
    const bundleJsonBytes = strToU8(`${JSON.stringify(metadata, null, 2)}\n`);
    const checksums = this.buildChecksums({
      ...appFiles,
      [bundleJsonPath]: bundleJsonBytes,
    });
    const checksumsJsonBytes = strToU8(`${JSON.stringify(checksums, null, 2)}\n`);
    const archiveBytes = zipSync(
      {
        ...appFiles,
        [bundleJsonPath]: bundleJsonBytes,
        [checksumsJsonPath]: checksumsJsonBytes,
      },
      {
        level: 9,
      },
    );
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
    await rm(targetDirectory, { recursive: true, force: true });
    await mkdir(targetDirectory, { recursive: true });
    const archive = unzipSync(new Uint8Array(await readFile(bundlePath)));
    const entryNames = Object.keys(archive).sort((left, right) => left.localeCompare(right));
    for (const entryName of entryNames) {
      const normalizedEntry = this.normalizeArchiveEntry(entryName);
      const targetPath = path.join(targetDirectory, normalizedEntry);
      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, Buffer.from(archive[entryName]));
    }
    const rawMetadata = await this.readJsonFile<Partial<AppBundleMetadata>>(
      path.join(targetDirectory, ".napp", "bundle.json"),
      "bundle metadata",
    );
    const metadata = this.normalizeMetadata(rawMetadata);
    const checksums = await this.readJsonFile<AppBundleChecksums>(
      path.join(targetDirectory, ".napp", "checksums.json"),
      "bundle checksums",
    );
    await this.verifyChecksums(targetDirectory, checksums);
    await this.manifestService.load(targetDirectory);
    return {
      appDirectory: targetDirectory,
      metadata,
      checksums,
    };
  };

  private collectRuntimeFiles = async (
    bundle: AppBundleMetadataBundleSource,
  ): Promise<{
    appFiles: Record<string, Uint8Array>;
    filePaths: string[];
  }> => {
    const appDirectory = bundle.appDirectory;
    const filePaths = new Set<string>([
      path.relative(appDirectory, bundle.manifestPath),
      path.relative(appDirectory, bundle.mainEntryPath),
    ]);
    await this.collectDirectoryPaths(bundle.uiDirectoryPath, appDirectory, filePaths);
    await this.collectDirectoryPaths(bundle.assetsDirectoryPath, appDirectory, filePaths);
    if (bundle.iconPath) {
      filePaths.add(path.relative(appDirectory, bundle.iconPath));
    }
    const sortedPaths = Array.from(filePaths).sort((left, right) => left.localeCompare(right));
    const appFiles: Record<string, Uint8Array> = {};
    for (const relativePath of sortedPaths) {
      appFiles[relativePath] = new Uint8Array(await readFile(path.join(appDirectory, relativePath)));
    }
    return {
      appFiles,
      filePaths: sortedPaths,
    };
  };

  private collectSourceFiles = async (
    bundle: AppBundleMetadataBundleSource,
  ): Promise<{
    appFiles: Record<string, Uint8Array>;
    filePaths: string[];
  }> => {
    const filePaths = new Set<string>();
    await this.collectSourceDirectoryPaths(bundle.appDirectory, bundle.appDirectory, filePaths);
    const sortedPaths = Array.from(filePaths).sort((left, right) => left.localeCompare(right));
    const appFiles: Record<string, Uint8Array> = {};
    for (const relativePath of sortedPaths) {
      if (
        bundle.manifest.main.kind === "wasi-http-component" &&
        relativePath === bundle.manifest.main.entry
      ) {
        appFiles[relativePath] = SOURCE_WASM_PLACEHOLDER_BYTES;
        continue;
      }
      appFiles[relativePath] = new Uint8Array(await readFile(path.join(bundle.appDirectory, relativePath)));
    }
    return {
      appFiles,
      filePaths: sortedPaths,
    };
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
        if (entry.isDirectory()) {
          await this.collectDirectoryPaths(entryPath, appDirectory, filePaths);
          continue;
        }
        if (!entry.isFile()) {
          continue;
        }
        filePaths.add(path.relative(appDirectory, entryPath));
      }
    } catch {
      return;
    }
  };

  private collectSourceDirectoryPaths = async (
    directoryPath: string,
    appDirectory: string,
    filePaths: Set<string>,
  ): Promise<void> => {
    try {
      const entries = await readdir(directoryPath, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = path.join(directoryPath, entry.name);
        const relativePath = path.relative(appDirectory, entryPath).replace(/\\/g, "/");
        if (entry.isDirectory()) {
          if (this.shouldExcludeSourcePath(relativePath)) {
            continue;
          }
          await this.collectSourceDirectoryPaths(entryPath, appDirectory, filePaths);
          continue;
        }
        if (!entry.isFile()) {
          continue;
        }
        if (this.shouldExcludeSourcePath(relativePath)) {
          continue;
        }
        filePaths.add(relativePath);
      }
    } catch {
      return;
    }
  };

  private shouldExcludeSourcePath = (relativePath: string): boolean => {
    return (
      relativePath === ".napp" ||
      relativePath.startsWith(".napp/") ||
      relativePath === "main/node_modules" ||
      relativePath.startsWith("main/node_modules/") ||
      relativePath === "main/dist" ||
      relativePath.startsWith("main/dist/") ||
      relativePath === "main/generated" ||
      relativePath.startsWith("main/generated/")
    );
  };

  private buildMetadata = (
    appId: string,
    name: string,
    version: string,
    distributionMode: AppDistributionMode,
  ): AppBundleMetadata => {
    return {
      bundleFormatVersion: 1,
      distributionMode,
      appId,
      name,
      version,
      entryManifest: "manifest.json",
      checksumsFile: ".napp/checksums.json",
    };
  };

  private normalizeMetadata = (rawMetadata: Partial<AppBundleMetadata>): AppBundleMetadata => {
    return {
      bundleFormatVersion: 1,
      distributionMode: rawMetadata.distributionMode === "source" ? "source" : "bundle",
      appId: String(rawMetadata.appId ?? ""),
      name: String(rawMetadata.name ?? ""),
      version: String(rawMetadata.version ?? ""),
      entryManifest: "manifest.json",
      checksumsFile: ".napp/checksums.json",
    };
  };

  private buildChecksums = (
    files: Record<string, Uint8Array>,
  ): AppBundleChecksums => {
    const entries = Object.entries(files).sort(([left], [right]) => left.localeCompare(right));
    return {
      algorithm: "sha256",
      files: Object.fromEntries(
        entries.map(([relativePath, fileBytes]) => [relativePath, this.computeSha256(fileBytes)]),
      ),
    };
  };

  private computeSha256 = (fileBytes: Uint8Array): string => {
    return createHash("sha256").update(Buffer.from(fileBytes)).digest("hex");
  };

  private normalizeBundleFileName = (appId: string): string => {
    return appId.replace(/[^a-zA-Z0-9._-]+/g, "-");
  };

  private normalizeArchiveEntry = (entryName: string): string => {
    const normalized = entryName.replace(/\\/g, "/");
    if (!normalized || normalized.startsWith("/") || normalized.includes("../")) {
      throw new Error(`bundle 内包含非法路径：${entryName}`);
    }
    return normalized;
  };

  private readJsonFile = async <T>(filePath: string, label: string): Promise<T> => {
    try {
      return JSON.parse(await readFile(filePath, "utf-8")) as T;
    } catch (error) {
      throw new Error(
        `无法读取 ${label}：${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  private verifyChecksums = async (
    appDirectory: string,
    checksums: AppBundleChecksums,
  ): Promise<void> => {
    if (checksums.algorithm !== "sha256") {
      throw new Error("当前只支持 sha256 checksums。");
    }
    const entries = Object.entries(checksums.files).sort(([left], [right]) => left.localeCompare(right));
    for (const [relativePath, expectedHash] of entries) {
      const fileBytes = new Uint8Array(await readFile(path.join(appDirectory, relativePath)));
      const actualHash = this.computeSha256(fileBytes);
      if (actualHash !== expectedHash) {
        throw new Error(`bundle checksum 校验失败：${relativePath}`);
      }
    }
  };
}

type AppBundleMetadataBundleSource = Awaited<ReturnType<AppManifestService["load"]>>;

const SOURCE_WASM_PLACEHOLDER_BYTES = Uint8Array.from(
  Buffer.from(
    "AGFzbQEAAAABBwFgAn9/AX8DAgEABxMBD3N1bW1hcml6ZV9ub3RlcwAACg0BCwAgACABakHIAWoL",
    "base64",
  ),
);
