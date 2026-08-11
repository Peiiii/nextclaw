export type AppPackageComponentKind = "panel" | "service";

export type AppPackageComponentSource = {
  kind: AppPackageComponentKind;
  id: string;
  packageId: string;
  packageVersion: string;
  sourcePath: string;
  manifestPath: string;
  dataDirectory: string;
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
  nameI18n?: Record<string, string>;
  descriptionI18n?: Record<string, string>;
  activeVersion: string;
  installedVersions: string[];
  enabled: boolean;
  builtIn: boolean;
  primaryPanelId?: string;
  components: AppPackageComponentView[];
  dataDirectory: string;
};

export type AppPackageList = {
  entries: AppPackageView[];
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
