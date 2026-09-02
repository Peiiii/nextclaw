import { strFromU8, unzipSync } from "fflate";
import { AppComponentContractService } from "#app-runtime/services/app-component-contract.service.js";
import { AppPlatformTargetService } from "#app-runtime/services/app-platform-target.service.js";
import { AppServiceLaunchService } from "#app-runtime/services/app-service-launch.service.js";
import type { AppArtifactTarget } from "#app-runtime/types/app-manifest.types.js";
import type {
  AppBundleChecksums,
  AppBundleMetadata,
  AppDistributionMode,
} from "#app-runtime/types/app-bundle.types.js";

const MAX_COMPRESSED_BYTES = 25 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_FILE_COUNT = 2_000;
const MAX_COMPRESSION_RATIO = 200;
const CHECKSUMS_PATH = ".napp/checksums.json";
const BUNDLE_METADATA_PATH = ".napp/bundle.json";
const ENTRY_MANIFEST_PATH = "manifest.json";
const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_FILE_SIGNATURE = 0x02014b50;
const ZIP_EOCD_MIN_BYTES = 22;
const ZIP_MAX_COMMENT_BYTES = 0xffff;
const ZIP_CENTRAL_FILE_HEADER_BYTES = 46;

type ArtifactManifestIdentity = {
  schemaVersion?: unknown;
  id?: unknown;
  name?: unknown;
  version?: unknown;
  icon?: unknown;
  main?: unknown;
  ui?: unknown;
  components?: unknown;
  runtime?: unknown;
  distribution?: unknown;
};

export type AppArtifactValidationExpectation = {
  appId: string;
  name: string;
  version: string;
  distributionMode: AppDistributionMode;
  manifest?: unknown;
  target?: AppArtifactTarget;
};

export type AppArtifactValidationResult = {
  archive: Record<string, Uint8Array>;
  artifactSha256: string;
  metadata: AppBundleMetadata;
  checksums: AppBundleChecksums;
  manifest: Record<string, unknown>;
};

type ZipCentralEntry = {
  name: string;
  uncompressedSize: number;
};

export class AppArtifactValidationService {
  private readonly platformTargetService = new AppPlatformTargetService();
  private readonly componentContractService = new AppComponentContractService(
    this.platformTargetService,
  );
  private readonly serviceLaunchService = new AppServiceLaunchService(
    this.platformTargetService,
  );

  validate = async (params: {
    bytes: Uint8Array;
    expected?: AppArtifactValidationExpectation;
  }): Promise<AppArtifactValidationResult> => {
    const { bytes, expected } = params;
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_COMPRESSED_BYTES) {
      throw new Error(
        `bundle 压缩体积必须在 1 到 ${MAX_COMPRESSED_BYTES} bytes 之间。`,
      );
    }
    const artifactSha256 = await this.sha256(bytes);
    const centralEntries = this.readCentralEntries(bytes);
    const archive = this.normalizeArchive(unzipSync(bytes));
    this.assertCentralEntriesMatchArchive(centralEntries, archive);
    const metadata = this.readMetadata(archive);
    const checksums = this.readChecksums(archive);
    await this.verifyChecksums(archive, checksums);
    const manifest = this.readJsonEntry<Record<string, unknown>>(
      archive,
      ENTRY_MANIFEST_PATH,
      "manifest.json",
    );
    this.assertManifestContract({ archive, manifest, metadata });
    if (expected) {
      this.assertExpectedContract({ archive, expected, manifest, metadata });
    }
    return { archive, artifactSha256, metadata, checksums, manifest };
  };

  private readCentralEntries = (bytes: Uint8Array): ZipCentralEntry[] => {
    const { centralDirectoryOffset, entryCount, eocdOffset, view } =
      this.readCentralDirectory(bytes);
    const entries: ZipCentralEntry[] = [];
    const names = new Set<string>();
    let cursor = centralDirectoryOffset;
    let totalUncompressedBytes = 0;
    for (let index = 0; index < entryCount; index += 1) {
      const { entry, entryEnd } = this.readCentralEntry({
        bytes,
        cursor,
        eocdOffset,
        view,
      });
      if (names.has(entry.name)) {
        throw new Error(`bundle 包含重复路径：${entry.name}`);
      }
      names.add(entry.name);
      totalUncompressedBytes += entry.uncompressedSize;
      if (totalUncompressedBytes > MAX_UNCOMPRESSED_BYTES) {
        throw new Error(
          `bundle 解压后超过 ${MAX_UNCOMPRESSED_BYTES} bytes 上限。`,
        );
      }
      entries.push(entry);
      cursor = entryEnd;
    }
    if (cursor !== eocdOffset) {
      throw new Error("bundle central directory 未被精确消费。");
    }
    return entries;
  };

  private readCentralDirectory = (bytes: Uint8Array) => {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const eocdOffset = this.findEocdOffset(view);
    const diskNumber = view.getUint16(eocdOffset + 4, true);
    const centralDirectoryDisk = view.getUint16(eocdOffset + 6, true);
    const entryCountOnDisk = view.getUint16(eocdOffset + 8, true);
    const entryCount = view.getUint16(eocdOffset + 10, true);
    const centralDirectorySize = view.getUint32(eocdOffset + 12, true);
    const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
    const commentLength = view.getUint16(eocdOffset + 20, true);
    if (
      diskNumber !== 0 ||
      centralDirectoryDisk !== 0 ||
      entryCountOnDisk !== entryCount
    ) {
      throw new Error("bundle 不支持跨磁盘 ZIP。");
    }
    if (
      entryCount === 0xffff ||
      centralDirectorySize === 0xffffffff ||
      centralDirectoryOffset === 0xffffffff
    ) {
      throw new Error("bundle 不支持 Zip64。");
    }
    if (
      entryCount === 0 ||
      entryCount > MAX_FILE_COUNT ||
      eocdOffset + ZIP_EOCD_MIN_BYTES + commentLength !== bytes.byteLength ||
      centralDirectoryOffset + centralDirectorySize !== eocdOffset
    ) {
      throw new Error("bundle central directory 无效。");
    }
    return { centralDirectoryOffset, entryCount, eocdOffset, view };
  };

  private readCentralEntry = (params: {
    bytes: Uint8Array;
    cursor: number;
    eocdOffset: number;
    view: DataView;
  }): { entry: ZipCentralEntry; entryEnd: number } => {
    const { bytes, cursor, eocdOffset, view } = params;
    if (
      cursor + ZIP_CENTRAL_FILE_HEADER_BYTES > eocdOffset ||
      view.getUint32(cursor, true) !== ZIP_CENTRAL_FILE_SIGNATURE
    ) {
      throw new Error("bundle central directory entry 无效。");
    }
    const versionMadeBy = view.getUint16(cursor + 4, true);
    const flags = view.getUint16(cursor + 8, true);
    const compressionMethod = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const entryCommentLength = view.getUint16(cursor + 32, true);
    const externalAttributes = view.getUint32(cursor + 38, true);
    const entryEnd =
      cursor +
      ZIP_CENTRAL_FILE_HEADER_BYTES +
      nameLength +
      extraLength +
      entryCommentLength;
    if (entryEnd > eocdOffset || nameLength === 0) {
      throw new Error("bundle central directory entry 长度无效。");
    }
    if ((flags & 0x1) !== 0 || (flags & 0x40) !== 0) {
      throw new Error("bundle 不允许加密文件。");
    }
    if (compressionMethod !== 0 && compressionMethod !== 8) {
      throw new Error(`bundle 不支持压缩方法 ${compressionMethod}。`);
    }
    const rawName = bytes.subarray(
      cursor + ZIP_CENTRAL_FILE_HEADER_BYTES,
      cursor + ZIP_CENTRAL_FILE_HEADER_BYTES + nameLength,
    );
    const name = this.normalizeEntry(this.decodeUtf8(rawName));
    this.assertRegularFile({
      externalAttributes,
      hostSystem: versionMadeBy >>> 8,
      name,
    });
    if (uncompressedSize > MAX_FILE_BYTES) {
      throw new Error(
        `bundle 单文件超过 ${MAX_FILE_BYTES} bytes 上限：${name}`,
      );
    }
    if (
      uncompressedSize > 1024 * 1024 &&
      (compressedSize === 0 ||
        uncompressedSize / compressedSize > MAX_COMPRESSION_RATIO)
    ) {
      throw new Error(
        `bundle 文件压缩比超过 ${MAX_COMPRESSION_RATIO}:1 上限：${name}`,
      );
    }
    return { entry: { name, uncompressedSize }, entryEnd };
  };

  private findEocdOffset = (view: DataView): number => {
    const minimumOffset = Math.max(
      0,
      view.byteLength - ZIP_EOCD_MIN_BYTES - ZIP_MAX_COMMENT_BYTES,
    );
    for (
      let offset = view.byteLength - ZIP_EOCD_MIN_BYTES;
      offset >= minimumOffset;
      offset -= 1
    ) {
      if (view.getUint32(offset, true) === ZIP_EOCD_SIGNATURE) {
        return offset;
      }
    }
    throw new Error("bundle 缺少有效 ZIP end-of-central-directory。");
  };

  private assertRegularFile = (params: {
    externalAttributes: number;
    hostSystem: number;
    name: string;
  }): void => {
    const { externalAttributes, hostSystem, name } = params;
    if (name.endsWith("/")) {
      throw new Error(`bundle 不允许目录 entry：${name}`);
    }
    if (hostSystem === 3) {
      const unixMode = externalAttributes >>> 16;
      const fileType = unixMode & 0xf000;
      if (fileType !== 0 && fileType !== 0x8000) {
        throw new Error(`bundle 只允许普通文件：${name}`);
      }
      return;
    }
    if ((externalAttributes & 0x10) !== 0) {
      throw new Error(`bundle 只允许普通文件：${name}`);
    }
  };

  private normalizeArchive = (
    archive: Record<string, Uint8Array>,
  ): Record<string, Uint8Array> => {
    const normalized: Record<string, Uint8Array> = {};
    for (const [rawName, fileBytes] of Object.entries(archive)) {
      const name = this.normalizeEntry(rawName);
      if (Object.hasOwn(normalized, name)) {
        throw new Error(`bundle 包含重复路径：${name}`);
      }
      normalized[name] = fileBytes;
    }
    return normalized;
  };

  private normalizeEntry = (rawName: string): string => {
    const normalized = rawName.replace(/\\/g, "/");
    const segments = normalized.split("/");
    if (
      !normalized ||
      normalized.startsWith("/") ||
      normalized.includes("\0") ||
      /^[A-Za-z]:/.test(normalized) ||
      segments.some(
        (segment) => !segment || segment === "." || segment === "..",
      )
    ) {
      throw new Error(`bundle 内包含非法路径：${rawName}`);
    }
    return segments.join("/");
  };

  private assertCentralEntriesMatchArchive = (
    entries: ZipCentralEntry[],
    archive: Record<string, Uint8Array>,
  ): void => {
    const centralPaths = entries
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
    const archivePaths = Object.keys(archive).sort((left, right) =>
      left.localeCompare(right),
    );
    if (
      centralPaths.length !== archivePaths.length ||
      centralPaths.some((entry, index) => entry !== archivePaths[index])
    ) {
      throw new Error("bundle 解压结果与 central directory 不一致。");
    }
    for (const entry of entries) {
      if (archive[entry.name]?.byteLength !== entry.uncompressedSize) {
        throw new Error(`bundle 解压后文件大小不一致：${entry.name}`);
      }
    }
  };

  private readMetadata = (
    archive: Record<string, Uint8Array>,
  ): AppBundleMetadata => {
    const raw = this.readJsonEntry<Partial<AppBundleMetadata>>(
      archive,
      BUNDLE_METADATA_PATH,
      "bundle metadata",
    );
    const distributionMode = raw.distributionMode ?? "bundle";
    if (
      raw.bundleFormatVersion !== 1 ||
      (distributionMode !== "bundle" && distributionMode !== "source") ||
      typeof raw.appId !== "string" ||
      !raw.appId ||
      typeof raw.name !== "string" ||
      !raw.name ||
      typeof raw.version !== "string" ||
      !raw.version ||
      raw.entryManifest !== ENTRY_MANIFEST_PATH ||
      raw.checksumsFile !== CHECKSUMS_PATH
    ) {
      throw new Error("bundle metadata 无效。");
    }
    return {
      ...raw,
      distributionMode,
      target: raw.target === undefined
        ? undefined
        : this.platformTargetService.parseArtifactTarget(
            raw.target,
            "bundle metadata.target",
          ),
    } as AppBundleMetadata;
  };

  private readChecksums = (
    archive: Record<string, Uint8Array>,
  ): AppBundleChecksums => {
    const raw = this.readJsonEntry<Partial<AppBundleChecksums>>(
      archive,
      CHECKSUMS_PATH,
      "bundle checksums",
    );
    if (raw.algorithm !== "sha256" || !this.isRecord(raw.files)) {
      throw new Error("bundle checksums 无效。");
    }
    return raw as AppBundleChecksums;
  };

  private verifyChecksums = async (
    archive: Record<string, Uint8Array>,
    checksums: AppBundleChecksums,
  ): Promise<void> => {
    const actualPaths = Object.keys(archive)
      .filter((entry) => entry !== CHECKSUMS_PATH)
      .sort((left, right) => left.localeCompare(right));
    const checksumPaths = Object.keys(checksums.files)
      .map((entry) => this.normalizeEntry(entry))
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
      const actualHash = await this.sha256(archive[relativePath] as Uint8Array);
      if (actualHash !== expectedHash) {
        throw new Error(`bundle checksum 校验失败：${relativePath}`);
      }
    }
  };

  private assertManifestContract = (params: {
    archive: Record<string, Uint8Array>;
    manifest: Record<string, unknown>;
    metadata: AppBundleMetadata;
  }): void => {
    const { archive, manifest, metadata } = params;
    const identity = manifest as ArtifactManifestIdentity;
    if (
      identity.id !== metadata.appId ||
      identity.name !== metadata.name ||
      identity.version !== metadata.version
    ) {
      throw new Error("bundle metadata 与 manifest.json 身份不一致。");
    }
    if (identity.schemaVersion === 2) {
      this.componentContractService.assertArtifact({
        archive,
        identity,
        manifest,
        distributionMode: metadata.distributionMode,
      });
    } else if (identity.schemaVersion === 1) {
      this.assertStandaloneEntry(archive, identity.main, "main.entry");
      this.assertStandaloneEntry(archive, identity.ui, "ui.entry");
    } else {
      throw new Error("manifest.schemaVersion 必须是 1 或 2。");
    }
    if (identity.icon !== undefined) {
      if (
        typeof identity.icon !== "string" ||
        !archive[this.normalizeEntry(identity.icon)]
      ) {
        throw new Error("bundle 缺少 manifest.icon 声明的文件。");
      }
    }
  };

  private assertStandaloneEntry = (
    archive: Record<string, Uint8Array>,
    rawContainer: unknown,
    pathLabel: string,
  ): void => {
    if (
      !this.isRecord(rawContainer) ||
      typeof rawContainer.entry !== "string"
    ) {
      throw new Error(`manifest.${pathLabel} 无效。`);
    }
    const entry = this.normalizeEntry(rawContainer.entry);
    if (!archive[entry]) {
      throw new Error(`bundle 缺少 manifest.${pathLabel} 文件：${entry}`);
    }
  };

  private assertExpectedContract = (params: {
    archive: Record<string, Uint8Array>;
    expected: AppArtifactValidationExpectation;
    manifest: Record<string, unknown>;
    metadata: AppBundleMetadata;
  }): void => {
    const { archive, expected, manifest, metadata } = params;
    if (
      expected.appId !== metadata.appId ||
      expected.name !== metadata.name ||
      expected.version !== metadata.version ||
      expected.distributionMode !== metadata.distributionMode
    ) {
      throw new Error("artifact metadata 与 publish payload 不一致。");
    }
    if (
      expected.target !== undefined &&
      (
        metadata.target === undefined ||
        this.platformTargetService.toTargetKey(expected.target) !==
          this.platformTargetService.toTargetKey(metadata.target)
      )
    ) {
      throw new Error("artifact target metadata 与 publish payload 不一致。");
    }
    if (
      expected.manifest !== undefined &&
      !this.isJsonSubset(this.toJsonValue(expected.manifest), manifest)
    ) {
      throw new Error(
        "artifact manifest.json 与 publish payload.manifest 不一致。",
      );
    }
    if (
      expected.target?.kind === "native" &&
      manifest.schemaVersion === 2 &&
      Array.isArray(manifest.components)
    ) {
      for (const rawComponent of manifest.components) {
        if (!this.isRecord(rawComponent) || rawComponent.kind !== "service") {
          continue;
        }
        const componentPath = typeof rawComponent.path === "string"
          ? this.normalizeEntry(rawComponent.path)
          : undefined;
        if (!componentPath) {
          throw new Error("service component path 无效。");
        }
        const serviceManifest = this.readJsonEntry<Record<string, unknown>>(
          archive,
          `${componentPath}/service-app.json`,
          `${componentPath}/service-app.json`,
        );
        this.serviceLaunchService.resolve(serviceManifest, expected.target);
      }
    }
  };

  private readJsonEntry = <T>(
    archive: Record<string, Uint8Array>,
    entryPath: string,
    label: string,
  ): T => {
    const bytes = archive[entryPath];
    if (!bytes) {
      throw new Error(`bundle 缺少 ${label}。`);
    }
    try {
      return JSON.parse(strFromU8(bytes)) as T;
    } catch (error) {
      throw new Error(
        `无法读取 ${label}：${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  private decodeUtf8 = (bytes: Uint8Array): string => {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new Error("bundle 文件名不是有效 UTF-8。");
    }
  };

  private sha256 = async (bytes: Uint8Array): Promise<string> => {
    const digest = await globalThis.crypto.subtle.digest(
      "SHA-256",
      new Uint8Array(bytes),
    );
    return [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  };

  private toJsonValue = (value: unknown): unknown => {
    const serialized = JSON.stringify(value);
    return serialized === undefined
      ? null
      : (JSON.parse(serialized) as unknown);
  };

  private isJsonSubset = (expected: unknown, actual: unknown): boolean => {
    if (Array.isArray(expected)) {
      return (
        Array.isArray(actual) &&
        expected.length === actual.length &&
        expected.every((entry, index) =>
          this.isJsonSubset(entry, actual[index]),
        )
      );
    }
    if (this.isRecord(expected)) {
      return (
        this.isRecord(actual) &&
        Object.entries(expected).every(
          ([key, value]) =>
            Object.hasOwn(actual, key) && this.isJsonSubset(value, actual[key]),
        )
      );
    }
    return Object.is(expected, actual);
  };

  private isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
