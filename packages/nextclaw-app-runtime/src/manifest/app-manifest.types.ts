export type AppDocumentAccessMode = "read" | "read-write";

export type AppDocumentAccessScope = {
  id: string;
  mode: AppDocumentAccessMode;
  description?: string;
};

export type AppPermissions = {
  documentAccess?: AppDocumentAccessScope[];
  allowedDomains?: string[];
  storage?: boolean | { namespace?: string };
  capabilities?: {
    hostBridge?: boolean;
  };
};

export type AppCoreWasmMainManifest = {
  kind: "wasm";
  entry: string;
  export: string;
  action: string;
};

export type AppWasiHttpComponentMainManifest = {
  kind: "wasi-http-component";
  entry: string;
};

export type AppMainManifest = AppCoreWasmMainManifest | AppWasiHttpComponentMainManifest;

export type AppUiManifest = {
  entry: string;
};

export type AppManifest = {
  schemaVersion: 1;
  id: string;
  name: string;
  version: string;
  description?: string;
  icon?: string;
  main: AppMainManifest;
  ui: AppUiManifest;
  permissions?: AppPermissions;
};

export type AppManifestBundle = {
  appDirectory: string;
  manifestPath: string;
  manifest: AppManifest;
  mainEntryPath: string;
  uiEntryPath: string;
  uiDirectoryPath: string;
  assetsDirectoryPath: string;
  iconPath?: string;
};

export type AppManifestSummary = {
  id: string;
  name: string;
  version: string;
  description?: string;
  mainKind: AppMainManifest["kind"];
  action?: string;
  manifestPath: string;
  mainEntryPath: string;
  uiEntryPath: string;
  iconPath?: string;
  permissions: AppPermissions;
};
