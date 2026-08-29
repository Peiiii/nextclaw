import type {
  AppPermissions,
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
  permissions: AppPermissions;
  resolvedProviderIds?: string[];
};

export type CapabilityProviderView = {
  providerId: string;
  appId: string;
  componentId: string;
  capabilities: Array<{ id: string; version?: string; resourceTypes?: string[] }>;
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

export type AppPackageReadinessStatus =
  | "ready"
  | "needs-capability"
  | "needs-configuration";

export type AppPackageReadinessRequirement = {
  componentId: string;
  kind: "capability" | "configuration";
  id: string;
  title: string;
  description?: string;
  remediation?: {
    kind: "agent-setup";
    summary: string;
    requiresUserAction?: boolean;
  };
};

export type AppPackageReadiness = {
  status: AppPackageReadinessStatus;
  requirements: AppPackageReadinessRequirement[];
};

export type AppPackageDependencyBinding = {
  componentId: string;
  requirementKind: "capability" | "resource";
  requirementId: string;
  providerId: string;
};

export type AppPackageDependencyCandidate = {
  requirement: AppPackageReadinessRequirement;
  providers: CapabilityProviderView[];
};

export type AppPackageDependencyView = {
  readiness: AppPackageReadiness;
  bindings: AppPackageDependencyBinding[];
  candidates: AppPackageDependencyCandidate[];
  resolvedProviderIds: Record<string, string[]>;
};

export type AppPackageDependencyBindingInput = {
  componentId: string;
  requirementKind: "capability" | "resource";
  requirementId: string;
  providerId: string;
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
  readiness: AppPackageReadiness;
  dependencies: AppPackageDependencyView;
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

export type AppPackageUninstallRollback = () => Promise<void>;

export type AppPackageRuntimeHooks = {
  listCapabilityProviders: () => Promise<CapabilityProviderView[]>;
  assertCanActivate: (sources: AppPackageComponentSource[]) => Promise<void>;
  afterActivate: (sources: AppPackageComponentSource[]) => Promise<void>;
  beforeDeactivate: (sources: AppPackageComponentSource[]) => Promise<void>;
  beforeUninstall: (
    sources: AppPackageComponentSource[],
  ) => Promise<AppPackageUninstallRollback | void>;
};

export type AppPackageErrorCode =
  | "APP_PACKAGE_CONFLICT"
  | "APP_PACKAGE_INCOMPATIBLE"
  | "APP_PACKAGE_NOT_READY"
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
