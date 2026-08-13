export const DEFAULT_APP_INSTANCE_ID = "default";
export const APP_STORAGE_LAYOUT_VERSION = 1;

export type AppStorageLayout = "legacy" | "instance-v1";

export type AppStorageContext = {
  layout: AppStorageLayout;
  layoutVersion: typeof APP_STORAGE_LAYOUT_VERSION;
  instanceId: string;
  instanceDirectory: string;
  dataDirectory: string;
  configDirectory: string;
  stateDirectory: string;
  cacheDirectory: string;
  temporaryDirectory: string;
  logsDirectory: string;
};

export type AppStorageUsage = {
  dataBytes: number;
  configBytes: number;
  stateBytes: number;
  cacheBytes: number;
  temporaryBytes: number;
  logsBytes: number;
  totalBytes: number;
};

export type AppInstanceRecord = {
  id: string;
  publisherId?: string;
  storage: AppStorageContext;
  dataSchemaVersion: number;
  createdAt: string;
  migratedAt?: string;
  legacyDataDirectory?: string;
};
