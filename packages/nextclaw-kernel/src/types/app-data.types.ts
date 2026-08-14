import type { AppStorageContext, AppStorageUsage } from "@nextclaw/app-runtime";

export type AppDataSource = "package" | "workspace-service";
export type AppDataLifecycle = "active" | "retained";

export type AppDataEntry = {
  id: string;
  appId: string;
  instanceId: string;
  publisherId?: string;
  displayName: string;
  source: AppDataSource;
  lifecycle: AppDataLifecycle;
  storage: AppStorageContext;
  usage: AppStorageUsage;
  createdAt: string;
  migratedAt?: string;
  actions: {
    deleteRetainedData: boolean;
  };
};

export type AppDataDiagnostic = {
  source: AppDataSource;
  instanceDirectory: string;
  message: string;
};

export type AppDataList = {
  entries: AppDataEntry[];
  diagnostics: AppDataDiagnostic[];
};

export type AppDataDeleteResult = {
  deleted: true;
  id: string;
  appId: string;
  instanceId: string;
};

export type AppDataErrorCode =
  | "APP_DATA_ACTIVE"
  | "APP_DATA_CONFIRMATION_MISMATCH"
  | "APP_DATA_INVALID_ID"
  | "APP_DATA_NOT_FOUND";

export class AppDataError extends Error {
  constructor(
    readonly code: AppDataErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AppDataError";
  }
}

export function isAppDataError(error: unknown): error is AppDataError {
  return error instanceof AppDataError;
}
