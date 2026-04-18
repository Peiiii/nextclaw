import { createHash, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

const ASSET_URI_SCHEME = "asset://store/";

export type StoredAssetRecord = {
  id: string;
  uri: string;
  storageKey: string;
  fileName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  sha256: string;
};

export type AssetRef = {
  uri: string;
};

export type AssetMeta = {
  uri: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type AssetPutInput =
  | {
      kind: "path";
      path: string;
      fileName?: string;
      mimeType?: string | null;
      createdAt?: Date;
    }
  | {
      kind: "bytes";
      bytes: Uint8Array;
      fileName: string;
      mimeType?: string | null;
      createdAt?: Date;
    };

function normalizeSegment(value: string): string {
  return value.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "") || "asset.bin";
}

function normalizeFileName(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "asset.bin";
}

function normalizeMimeType(value: string | null | undefined): string {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized.length > 0 ? normalized : "application/octet-stream";
}

function inferMimeTypeFromFileName(fileName: string): string | null {
  const normalized = fileName.trim().toLowerCase();
  if (normalized.endsWith(".mp3")) return "audio/mpeg";
  if (normalized.endsWith(".m4a")) return "audio/mp4";
  if (normalized.endsWith(".wav")) return "audio/wav";
  if (normalized.endsWith(".ogg")) return "audio/ogg";
  if (normalized.endsWith(".opus")) return "audio/opus";
  if (normalized.endsWith(".flac")) return "audio/flac";
  if (normalized.endsWith(".aac")) return "audio/aac";
  if (normalized.endsWith(".weba")) return "audio/webm";
  if (normalized.endsWith(".mp4") || normalized.endsWith(".m4v")) return "video/mp4";
  if (normalized.endsWith(".mov")) return "video/quicktime";
  if (normalized.endsWith(".webm")) return "video/webm";
  if (normalized.endsWith(".mkv")) return "video/x-matroska";
  if (normalized.endsWith(".avi")) return "video/x-msvideo";
  if (normalized.endsWith(".wmv")) return "video/x-ms-wmv";
  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg";
  if (normalized.endsWith(".gif")) return "image/gif";
  if (normalized.endsWith(".webp")) return "image/webp";
  if (normalized.endsWith(".svg")) return "image/svg+xml";
  if (normalized.endsWith(".pdf")) return "application/pdf";
  if (normalized.endsWith(".json")) return "application/json";
  if (normalized.endsWith(".txt")) return "text/plain";
  return null;
}

function resolveStoredMimeType(fileName: string, mimeType?: string | null): string {
  const normalized = normalizeMimeType(mimeType);
  if (normalized !== "application/octet-stream") {
    return normalized;
  }
  return inferMimeTypeFromFileName(fileName) ?? normalized;
}

function buildAssetId(): string {
  return `asset_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
}

function ensureAssetRoot(rootDir: string): string {
  const normalized = rootDir.trim();
  if (!normalized) {
    throw new Error("LocalAssetStore requires a non-empty rootDir.");
  }
  return resolve(normalized);
}

function buildStorageKey(timestamp: Date, assetId: string): string {
  const year = String(timestamp.getFullYear());
  const month = String(timestamp.getMonth() + 1).padStart(2, "0");
  const day = String(timestamp.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}/${assetId}`;
}

function buildAssetUri(storageKey: string): string {
  return `${ASSET_URI_SCHEME}${storageKey}`;
}

function parseAssetUri(uri: string): string | null {
  const normalized = uri.trim();
  if (!normalized.startsWith(ASSET_URI_SCHEME)) {
    return null;
  }
  const storageKey = normalized.slice(ASSET_URI_SCHEME.length).replace(/^\/+/, "").trim();
  return storageKey.length > 0 ? storageKey : null;
}

function ensureStorageKey(storageKey: string): string {
  const normalized = storageKey.trim().replace(/^\/+|\/+$/g, "");
  if (!normalized) {
    throw new Error("Asset storage key must not be empty.");
  }
  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error(`Invalid asset storage key: ${storageKey}`);
  }
  return segments.join("/");
}

function hydrateStoredAssetRecord(value: StoredAssetRecord): StoredAssetRecord {
  const fileName = normalizeFileName(value.fileName);
  return {
    ...value,
    fileName,
    storedName: normalizeSegment(value.storedName || fileName),
    mimeType: normalizeMimeType(value.mimeType),
  };
}

function toAssetMeta(record: StoredAssetRecord): AssetMeta {
  return {
    uri: record.uri,
    fileName: record.fileName,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    createdAt: record.createdAt,
  };
}

export function isTextLikeAsset(params: { mimeType?: string | null; fileName?: string | null }): boolean {
  const mimeType = normalizeMimeType(params.mimeType);
  if (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/xml" ||
    mimeType === "text/xml" ||
    mimeType === "application/yaml" ||
    mimeType === "text/yaml" ||
    mimeType === "application/x-yaml" ||
    mimeType === "text/csv"
  ) {
    return true;
  }

  const normalizedName = (params.fileName ?? "").trim().toLowerCase();
  return [
    ".json",
    ".md",
    ".txt",
    ".csv",
    ".xml",
    ".yaml",
    ".yml",
    ".js",
    ".mjs",
    ".cjs",
    ".ts",
    ".tsx",
    ".jsx",
    ".py",
    ".rb",
    ".go",
    ".rs",
    ".java",
    ".kt",
    ".swift",
    ".php",
    ".css",
    ".scss",
    ".html",
    ".sql",
    ".sh",
  ].some((suffix) => normalizedName.endsWith(suffix));
}

export class LocalAssetStore {
  readonly rootDir: string;

  constructor(options: { rootDir: string }) {
    this.rootDir = ensureAssetRoot(options.rootDir);
  }

  async put(input: AssetPutInput): Promise<AssetRef> {
    const record =
      input.kind === "path"
        ? await this.putFromPath(input)
        : await this.putFromBytes({
            fileName: input.fileName,
            mimeType: input.mimeType,
            bytes: input.bytes,
            createdAt: input.createdAt,
          });
    return { uri: record.uri };
  }

  async putBytes(params: {
    fileName: string;
    mimeType?: string | null;
    bytes: Uint8Array;
    createdAt?: Date;
  }): Promise<StoredAssetRecord> {
    return this.putFromBytes(params);
  }

  async putPath(params: {
    path: string;
    fileName?: string;
    mimeType?: string | null;
    createdAt?: Date;
  }): Promise<StoredAssetRecord> {
    return this.putFromPath({
      kind: "path",
      ...params,
    });
  }

  async export(ref: AssetRef, targetPath: string): Promise<string> {
    const record = await this.statRecord(ref.uri);
    if (!record) {
      throw new Error(`Asset not found: ${ref.uri}`);
    }
    const outputPath = resolve(targetPath);
    await ensureParentDirectory(outputPath);
    await copyFile(this.resolveContentPathOrThrow(record), outputPath);
    return outputPath;
  }

  async stat(ref: AssetRef): Promise<AssetMeta | null> {
    const record = await this.statRecord(ref.uri);
    return record ? toAssetMeta(record) : null;
  }

  getByUri(uri: string): StoredAssetRecord | null {
    const storageKey = parseAssetUri(uri);
    if (!storageKey) {
      return null;
    }
    const metaPath = join(this.resolveStorageKeyDirectory(storageKey), "meta.json");
    if (!existsSync(metaPath)) {
      return null;
    }
    const text = readFileSync(metaPath, "utf8");
    return hydrateStoredAssetRecord(JSON.parse(text) as StoredAssetRecord);
  }

  async statRecord(uri: string): Promise<StoredAssetRecord | null> {
    const record = this.getByUri(uri);
    if (!record) {
      return null;
    }
    try {
      await stat(this.resolveContentPathOrThrow(record));
      return record;
    } catch {
      return null;
    }
  }

  async readAssetBytes(uri: string): Promise<Buffer | null> {
    const record = await this.statRecord(uri);
    if (!record) {
      return null;
    }
    try {
      return await readFile(this.resolveContentPathOrThrow(record));
    } catch {
      return null;
    }
  }

  resolveContentPath(uri: string): string | null {
    const record = this.getByUri(uri);
    return record ? this.resolveContentPathOrThrow(record) : null;
  }

  private async putFromPath(input: Extract<AssetPutInput, { kind: "path" }>): Promise<StoredAssetRecord> {
    const sourcePath = resolve(input.path);
    const sourceStats = await stat(sourcePath);
    if (!sourceStats.isFile()) {
      throw new Error(`Asset source path is not a file: ${sourcePath}`);
    }
    const bytes = readFileSync(sourcePath);
    const record = this.buildRecord({
      fileName: input.fileName ?? basename(sourcePath),
      mimeType: input.mimeType,
      bytes,
      createdAt: input.createdAt,
    });
    const assetDir = this.resolveStorageKeyDirectory(record.storageKey);
    await mkdir(assetDir, { recursive: true });
    copyFileSync(sourcePath, join(assetDir, record.storedName));
    await this.writeMeta(assetDir, record);
    return record;
  }

  private async putFromBytes(params: {
    fileName: string;
    mimeType?: string | null;
    bytes: Uint8Array;
    createdAt?: Date;
  }): Promise<StoredAssetRecord> {
    const { bytes: rawBytes, createdAt, fileName, mimeType } = params;
    const bytes = Buffer.from(rawBytes);
    const record = this.buildRecord({
      fileName,
      mimeType,
      bytes,
      createdAt,
    });
    const assetDir = this.resolveStorageKeyDirectory(record.storageKey);
    await mkdir(assetDir, { recursive: true });
    await writeFile(join(assetDir, record.storedName), bytes);
    await this.writeMeta(assetDir, record);
    return record;
  }

  private buildRecord(params: {
    fileName: string;
    mimeType?: string | null;
    bytes: Buffer;
    createdAt?: Date;
  }): StoredAssetRecord {
    const { bytes, createdAt: rawCreatedAt, fileName: rawFileName, mimeType } = params;
    const createdAt = rawCreatedAt ?? new Date();
    const id = buildAssetId();
    const storageKey = buildStorageKey(createdAt, id);
    const fileName = normalizeFileName(rawFileName);
    return {
      id,
      uri: buildAssetUri(storageKey),
      storageKey,
      fileName,
      storedName: normalizeSegment(fileName),
      mimeType: resolveStoredMimeType(fileName, mimeType),
      sizeBytes: bytes.length,
      createdAt: createdAt.toISOString(),
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  }

  private async writeMeta(assetDir: string, record: StoredAssetRecord): Promise<void> {
    await writeFile(join(assetDir, "meta.json"), `${JSON.stringify(record)}\n`, "utf8");
  }

  private resolveContentPathOrThrow(record: StoredAssetRecord): string {
    return join(this.resolveStorageKeyDirectory(record.storageKey), record.storedName);
  }

  private resolveStorageKeyDirectory(storageKey: string): string {
    return join(this.rootDir, ensureStorageKey(storageKey));
  }
}

export function buildAssetContentPath(params: {
  basePath: string;
  assetUri: string;
}): string {
  const query = new URLSearchParams({ uri: params.assetUri });
  return `${params.basePath}?${query.toString()}`;
}

export async function ensureParentDirectory(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}
