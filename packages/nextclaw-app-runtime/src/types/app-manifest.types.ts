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

export type AppStandaloneManifest = {
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

export type AppComponentKind = "panel" | "service";

export type AppComponentReference = {
  kind: AppComponentKind;
  path: string;
};

export type AppComponentManifest = {
  schemaVersion: 2;
  id: string;
  name: string;
  version: string;
  description?: string;
  icon?: string;
  engines?: {
    nextclaw?: string;
  };
  presentation?: {
    primaryPanel?: string;
  };
  components: AppComponentReference[];
};

export type AppManifest = AppStandaloneManifest | AppComponentManifest;

export type AppResolvedComponent = AppComponentReference & {
  id: string;
  componentDirectory: string;
  manifestPath: string;
};

export type AppStandaloneManifestBundle = {
  appDirectory: string;
  manifestPath: string;
  manifest: AppStandaloneManifest;
  mainEntryPath: string;
  uiEntryPath: string;
  uiDirectoryPath: string;
  assetsDirectoryPath: string;
  iconPath?: string;
};

export type AppComponentManifestBundle = {
  appDirectory: string;
  manifestPath: string;
  manifest: AppComponentManifest;
  components: AppResolvedComponent[];
  assetsDirectoryPath: string;
  iconPath?: string;
  primaryPanelId?: string;
};

export type AppManifestBundle = AppStandaloneManifestBundle | AppComponentManifestBundle;

export type AppStandaloneManifestSummary = {
  schemaVersion: 1;
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

export type AppComponentManifestSummary = {
  schemaVersion: 2;
  id: string;
  name: string;
  version: string;
  description?: string;
  manifestPath: string;
  iconPath?: string;
  primaryPanelId?: string;
  components: AppResolvedComponent[];
};

export type AppManifestSummary = AppStandaloneManifestSummary | AppComponentManifestSummary;

export function isAppStandaloneManifestBundle(
  bundle: AppManifestBundle,
): bundle is AppStandaloneManifestBundle {
  return bundle.manifest.schemaVersion === 1;
}

export function isAppComponentManifestBundle(
  bundle: AppManifestBundle,
): bundle is AppComponentManifestBundle {
  return bundle.manifest.schemaVersion === 2;
}
