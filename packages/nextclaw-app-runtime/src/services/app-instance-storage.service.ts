import { randomUUID } from "node:crypto";
import { access, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { AppHomeService } from "#app-runtime/services/app-home.service.js";
import { FileLockService } from "#app-runtime/services/file-lock.service.js";
import {
  APP_STORAGE_LAYOUT_VERSION,
  DEFAULT_APP_INSTANCE_ID,
  type AppInstanceMetadata,
  type AppInstanceRecord,
  type AppStorageContext,
  type AppStorageUsage,
} from "#app-runtime/types/app-storage.types.js";

const STORAGE_METADATA_FILE = "metadata.json";
const SAFE_ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

export class AppInstanceStorageService {
  private readonly fileLockService = new FileLockService();

  constructor(private readonly appHomeService: AppHomeService = new AppHomeService()) {}

  materializeDefaultInstance = async (params: {
    appId: string;
    publisherId?: string;
    legacyDataDirectory?: string;
    dataSchemaVersion?: number;
  }): Promise<AppInstanceRecord> => {
    return await this.materialize({
      ...params,
      instanceId: DEFAULT_APP_INSTANCE_ID,
      instanceDirectory: this.appHomeService.getAppInstanceDirectory(
        params.appId,
        DEFAULT_APP_INSTANCE_ID,
      ),
    });
  };

  materialize = async (params: {
    appId: string;
    instanceId: string;
    instanceDirectory: string;
    publisherId?: string;
    legacyDataDirectory?: string;
    dataSchemaVersion?: number;
  }): Promise<AppInstanceRecord> => {
    this.assertSafeId(params.appId, "appId");
    this.assertSafeId(params.instanceId, "instanceId");
    const instanceDirectory = path.resolve(params.instanceDirectory);
    return await this.fileLockService.withLock(
      `${instanceDirectory}.lock`,
      async () => await this.materializeUnlocked({ ...params, instanceDirectory }),
    );
  };

  private materializeUnlocked = async (params: {
    appId: string;
    instanceId: string;
    instanceDirectory: string;
    publisherId?: string;
    legacyDataDirectory?: string;
    dataSchemaVersion?: number;
  }): Promise<AppInstanceRecord> => {
    const {
      appId,
      dataSchemaVersion,
      instanceDirectory,
      instanceId,
      publisherId,
    } = params;
    const existingInstance = await this.resolveExistingInstance({
      appId,
      dataSchemaVersion,
      instanceDirectory,
      instanceId,
      publisherId,
    });
    if (existingInstance) {
      return existingInstance;
    }

    return await this.materializeNewInstance(params);
  };

  private materializeNewInstance = async (params: {
    appId: string;
    instanceId: string;
    instanceDirectory: string;
    publisherId?: string;
    legacyDataDirectory?: string;
    dataSchemaVersion?: number;
  }): Promise<AppInstanceRecord> => {
    const {
      appId,
      dataSchemaVersion,
      instanceDirectory,
      instanceId,
      legacyDataDirectory: legacyDataPath,
      publisherId,
    } = params;

    await mkdir(path.dirname(instanceDirectory), { recursive: true });
    const stagingDirectory = `${instanceDirectory}.migrating-${randomUUID()}`;
    const legacyDataDirectory = legacyDataPath
      ? path.resolve(legacyDataPath)
      : undefined;
    const createdAt = new Date().toISOString();
    let movedLegacyData = false;
    try {
      const stagingStorage = this.buildContext(stagingDirectory, instanceId);
      await mkdir(stagingDirectory, { recursive: false });
      if (legacyDataDirectory && await this.pathExists(legacyDataDirectory)) {
        await rename(legacyDataDirectory, stagingStorage.dataDirectory);
        movedLegacyData = true;
      }
      await this.ensureStorageDirectories(stagingStorage);
      const metadata: AppInstanceMetadata = {
        schemaVersion: 1,
        appId,
        instanceId,
        publisherId,
        layoutVersion: APP_STORAGE_LAYOUT_VERSION,
        createdAt,
        ...(movedLegacyData
          ? { migratedAt: new Date().toISOString(), legacyDataDirectory }
          : {}),
      };
      await writeFile(
        path.join(stagingDirectory, STORAGE_METADATA_FILE),
        `${JSON.stringify(metadata, null, 2)}\n`,
        { encoding: "utf8", mode: 0o600, flag: "wx" },
      );
      await rename(stagingDirectory, instanceDirectory);
      return this.toInstanceRecord(
        metadata,
        this.buildContext(instanceDirectory, instanceId),
        dataSchemaVersion,
      );
    } catch (error) {
      if (
        movedLegacyData &&
        legacyDataDirectory &&
        !await this.pathExists(legacyDataDirectory)
      ) {
        const stagedDataDirectory = path.join(stagingDirectory, "data");
        if (await this.pathExists(stagedDataDirectory)) {
          await rename(stagedDataDirectory, legacyDataDirectory);
        }
      }
      await rm(stagingDirectory, { recursive: true, force: true });
      if (await this.pathExists(instanceDirectory)) {
        const racedMetadata = await this.readMetadata(instanceDirectory);
        if (racedMetadata) {
          this.assertMetadataIdentity(racedMetadata, appId, instanceId, publisherId);
          const storage = this.buildContext(instanceDirectory, instanceId);
          await this.ensureStorageDirectories(storage);
          return this.toInstanceRecord(racedMetadata, storage, dataSchemaVersion);
        }
      }
      throw error;
    }
  };

  buildLegacyDefaultInstance = (params: {
    appId: string;
    dataDirectory: string;
    createdAt: string;
  }): AppInstanceRecord => {
    const { appId, createdAt, dataDirectory } = params;
    const instanceDirectory = this.appHomeService.getAppInstanceDirectory(
      appId,
      DEFAULT_APP_INSTANCE_ID,
    );
    return {
      id: DEFAULT_APP_INSTANCE_ID,
      publisherId: undefined,
      storage: {
        ...this.buildContext(instanceDirectory, DEFAULT_APP_INSTANCE_ID),
        layout: "legacy",
        dataDirectory: path.resolve(dataDirectory),
      },
      dataSchemaVersion: 1,
      createdAt,
      legacyDataDirectory: path.resolve(dataDirectory),
    };
  };

  measureUsage = async (storage: AppStorageContext): Promise<AppStorageUsage> => {
    const [dataBytes, configBytes, stateBytes, cacheBytes, temporaryBytes, logsBytes] =
      await Promise.all([
        this.measureDirectory(storage.dataDirectory),
        this.measureDirectory(storage.configDirectory),
        this.measureDirectory(storage.stateDirectory),
        this.measureDirectory(storage.cacheDirectory),
        this.measureDirectory(storage.temporaryDirectory),
        this.measureDirectory(storage.logsDirectory),
      ]);
    return {
      dataBytes,
      configBytes,
      stateBytes,
      cacheBytes,
      temporaryBytes,
      logsBytes,
      totalBytes: dataBytes + configBytes + stateBytes + cacheBytes + temporaryBytes + logsBytes,
    };
  };

  inspect = async (params: {
    appId: string;
    instanceId: string;
    instanceDirectory: string;
  }): Promise<AppInstanceRecord> => {
    const { appId, instanceId, instanceDirectory: instancePath } = params;
    this.assertSafeId(appId, "appId");
    this.assertSafeId(instanceId, "instanceId");
    const instanceDirectory = path.resolve(instancePath);
    const metadata = await this.readMetadata(instanceDirectory);
    if (!metadata) {
      throw new Error(`App Instance metadata 不存在：${instanceDirectory}`);
    }
    this.assertMetadataCoordinates(metadata, appId, instanceId);
    return this.toInstanceRecord(
      metadata,
      this.buildContext(instanceDirectory, instanceId),
    );
  };

  rollbackNewInstance = async (params: {
    instance: AppInstanceRecord;
    legacyDataDirectory?: string;
  }): Promise<void> => {
    const { instance, legacyDataDirectory: legacyDataPath } = params;
    const instanceDirectory = instance.storage.instanceDirectory;
    const metadata = await this.readMetadata(instanceDirectory);
    if (!metadata) {
      return;
    }
    const legacyDataDirectory = legacyDataPath
      ? path.resolve(legacyDataPath)
      : undefined;
    if (
      legacyDataDirectory &&
      !await this.pathExists(legacyDataDirectory) &&
      await this.pathExists(instance.storage.dataDirectory)
    ) {
      await mkdir(path.dirname(legacyDataDirectory), { recursive: true });
      await rename(instance.storage.dataDirectory, legacyDataDirectory);
    }
    await rm(instanceDirectory, { recursive: true, force: true });
  };

  private resolveExistingInstance = async (params: {
    appId: string;
    dataSchemaVersion?: number;
    instanceDirectory: string;
    instanceId: string;
    publisherId?: string;
  }): Promise<AppInstanceRecord | undefined> => {
    const { appId, dataSchemaVersion, instanceDirectory, instanceId, publisherId } = params;
    let metadata = await this.readMetadata(instanceDirectory);
    if (!metadata) {
      return undefined;
    }
    this.assertMetadataIdentity(metadata, appId, instanceId, publisherId);
    if (publisherId && !metadata.publisherId) {
      metadata = await this.bindPublisher(instanceDirectory, metadata, publisherId);
    }
    const storage = this.buildContext(instanceDirectory, instanceId);
    await this.ensureStorageDirectories(storage);
    return this.toInstanceRecord(metadata, storage, dataSchemaVersion);
  };

  private buildContext = (
    instanceDirectory: string,
    instanceId: string,
  ): AppStorageContext => ({
    layout: "instance-v1",
    layoutVersion: APP_STORAGE_LAYOUT_VERSION,
    instanceId,
    instanceDirectory,
    dataDirectory: path.join(instanceDirectory, "data"),
    configDirectory: path.join(instanceDirectory, "config"),
    stateDirectory: path.join(instanceDirectory, "state"),
    cacheDirectory: path.join(instanceDirectory, "cache"),
    temporaryDirectory: path.join(instanceDirectory, "tmp"),
    logsDirectory: path.join(instanceDirectory, "logs"),
  });

  private ensureStorageDirectories = async (storage: AppStorageContext): Promise<void> => {
    await Promise.all([
      mkdir(storage.dataDirectory, { recursive: true }),
      mkdir(storage.configDirectory, { recursive: true }),
      mkdir(storage.stateDirectory, { recursive: true }),
      mkdir(storage.cacheDirectory, { recursive: true }),
      mkdir(storage.temporaryDirectory, { recursive: true }),
      mkdir(storage.logsDirectory, { recursive: true }),
    ]);
  };

  private readMetadata = async (
    instanceDirectory: string,
  ): Promise<AppInstanceMetadata | undefined> => {
    try {
      const raw = JSON.parse(
        await readFile(path.join(instanceDirectory, STORAGE_METADATA_FILE), "utf8"),
      ) as Partial<AppInstanceMetadata>;
      if (
        raw.schemaVersion !== 1 ||
        raw.layoutVersion !== APP_STORAGE_LAYOUT_VERSION ||
        typeof raw.appId !== "string" ||
        typeof raw.instanceId !== "string" ||
        (raw.publisherId !== undefined && typeof raw.publisherId !== "string") ||
        typeof raw.createdAt !== "string"
      ) {
        throw new Error(`无效的 App Instance metadata：${instanceDirectory}`);
      }
      return raw as AppInstanceMetadata;
    } catch (error) {
      if (this.isMissingFileError(error)) {
        return undefined;
      }
      throw error;
    }
  };

  private toInstanceRecord = (
    metadata: AppInstanceMetadata,
    storage: AppStorageContext,
    dataSchemaVersion = 1,
  ): AppInstanceRecord => ({
    id: metadata.instanceId,
    publisherId: metadata.publisherId,
    storage,
    dataSchemaVersion,
    createdAt: metadata.createdAt,
    migratedAt: metadata.migratedAt,
    legacyDataDirectory: metadata.legacyDataDirectory,
  });

  private assertMetadataIdentity = (
    metadata: AppInstanceMetadata,
    appId: string,
    instanceId: string,
    publisherId?: string,
  ): void => {
    this.assertMetadataCoordinates(metadata, appId, instanceId);
    if (metadata.publisherId && metadata.publisherId !== publisherId) {
      throw new Error(
        `App Instance ${appId}/${instanceId} 已绑定发布者 ${metadata.publisherId}，拒绝由 ${publisherId ?? "未验证本地来源"} 接管。`,
      );
    }
  };

  private assertMetadataCoordinates = (
    metadata: AppInstanceMetadata,
    appId: string,
    instanceId: string,
  ): void => {
    if (metadata.appId !== appId || metadata.instanceId !== instanceId) {
      throw new Error(
        `App Instance identity 不匹配：期望 ${appId}/${instanceId}，实际 ${metadata.appId}/${metadata.instanceId}`,
      );
    }
  };

  private bindPublisher = async (
    instanceDirectory: string,
    metadata: AppInstanceMetadata,
    publisherId: string,
  ): Promise<AppInstanceMetadata> => {
    const nextMetadata = { ...metadata, publisherId };
    const metadataPath = path.join(instanceDirectory, STORAGE_METADATA_FILE);
    const temporaryPath = `${metadataPath}.${randomUUID()}.tmp`;
    try {
      await writeFile(
        temporaryPath,
        `${JSON.stringify(nextMetadata, null, 2)}\n`,
        { encoding: "utf8", mode: 0o600, flag: "wx" },
      );
      await rename(temporaryPath, metadataPath);
      return nextMetadata;
    } finally {
      await rm(temporaryPath, { force: true });
    }
  };

  private assertSafeId = (value: string, field: string): void => {
    if (!SAFE_ID_PATTERN.test(value)) {
      throw new Error(`${field} 不是安全的 App Instance 标识：${value}`);
    }
  };

  private measureDirectory = async (directory: string): Promise<number> => {
    try {
      const entries = await readdir(directory, { withFileTypes: true });
      let bytes = 0;
      for (const entry of entries) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isSymbolicLink()) {
          continue;
        }
        if (entry.isDirectory()) {
          bytes += await this.measureDirectory(entryPath);
          continue;
        }
        if (entry.isFile()) {
          bytes += (await stat(entryPath)).size;
        }
      }
      return bytes;
    } catch (error) {
      if (this.isMissingFileError(error)) {
        return 0;
      }
      throw error;
    }
  };

  private pathExists = async (targetPath: string): Promise<boolean> => {
    try {
      await access(targetPath);
      return true;
    } catch {
      return false;
    }
  };

  private isMissingFileError = (error: unknown): boolean =>
    typeof error === "object" && error !== null &&
    "code" in error && (error as { code?: unknown }).code === "ENOENT";
}
