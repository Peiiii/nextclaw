import type {
  AppRuntimeIsolation,
  AppRuntimeProfile,
  AppStorageContext,
  AppStorageUsage,
} from "@nextclaw/app-runtime";

export type AppPackageComponentKind = "panel" | "service";

export type AppPackageComponentSource = {
  kind: AppPackageComponentKind;
  id: string;
  packageId: string;
  packageVersion: string;
  sourcePath: string;
  manifestPath: string;
  dataDirectory: string;
  instanceId: string;
  storage: AppStorageContext;
  runtimeProfile: AppRuntimeProfile;
  isolation: AppRuntimeIsolation;
};

export type AppPackageUnavailableDiagnostic = {
  appId: string;
  message: string;
};

export type AppPackageComponentSourceList = {
  sources: AppPackageComponentSource[];
  unavailablePackages: AppPackageUnavailableDiagnostic[];
};

export type AppPackageComponentView = AppPackageComponentSource & {
  title?: string;
  description?: string;
  icon?: string;
  titleI18n?: Record<string, string>;
  descriptionI18n?: Record<string, string>;
};

export type AppPackageView = {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  nameI18n?: Record<string, string>;
  descriptionI18n?: Record<string, string>;
  activeVersion: string;
  installedVersions: string[];
  enabled: boolean;
  builtIn: boolean;
  primaryPanelId?: string;
  components: AppPackageComponentView[];
  dataDirectory: string;
  instanceId: string;
  storage: AppStorageContext;
  storageUsage?: AppStorageUsage;
  runtimeProfile: AppRuntimeProfile;
  isolation: AppRuntimeIsolation;
};

export type AppPackageHostTarget = {
  key: string;
  operatingSystem: "darwin" | "linux" | "win32";
  architecture: "x64" | "arm64";
  abi?: "gnu" | "musl" | "msvc";
};

export type AppPackageList = {
  entries: AppPackageView[];
  hostTarget?: AppPackageHostTarget;
};

export type AppPackageOperationAction = "install" | "rollback" | "uninstall" | "update";

export type AppPackageOperationStatus =
  | "queued"
  | "resolving"
  | "downloading"
  | "verifying"
  | "installing"
  | "finalizing"
  | "succeeded"
  | "failed"
  | "interrupted";

export type AppPackageOperationInput =
  | {
      action: "install";
      source: string;
      registryUrl?: string;
    }
  | {
      action: "update";
      appId: string;
      version?: string;
      registryUrl?: string;
    }
  | {
      action: "rollback";
      appId: string;
      version: string;
    }
  | {
      action: "uninstall";
      appId: string;
      purgeData?: boolean;
    };

export type AppPackageOperationResult = {
  appId: string;
  activeVersion?: string;
  changed?: boolean;
  removedVersions?: string[];
  dataRemoved?: boolean;
};

export type AppPackageOperationView = {
  id: string;
  action: AppPackageOperationAction;
  appId?: string;
  source?: string;
  targetVersion?: string;
  status: AppPackageOperationStatus;
  completedSteps: number;
  totalSteps: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
  result?: AppPackageOperationResult;
};

export type AppPackageOperationList = {
  entries: AppPackageOperationView[];
};

export type AppPackageConflict = {
  componentId: string;
  componentKind: AppPackageComponentKind;
  conflictingSource: string;
};

export type AppPackageRuntimeHooks = {
  assertCanActivate: (sources: AppPackageComponentSource[]) => Promise<void>;
  beforeDeactivate: (sources: AppPackageComponentSource[]) => Promise<void>;
  beforeUninstall: (sources: AppPackageComponentSource[]) => Promise<void>;
};

export type AppPackageErrorCode =
  | "APP_PACKAGE_CONFLICT"
  | "APP_PACKAGE_INCOMPATIBLE"
  | "APP_PACKAGE_NOT_FOUND"
  | "APP_PACKAGE_OPERATION_FAILED";

export class AppPackageError extends Error {
  constructor(
    readonly code: AppPackageErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AppPackageError";
  }
}

export function isAppPackageError(error: unknown): error is AppPackageError {
  return error instanceof AppPackageError;
}
