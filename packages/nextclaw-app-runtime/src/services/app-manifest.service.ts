import { access, lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { AppPlatformTargetService } from "#app-runtime/services/app-platform-target.service.js";
import type {
  AppComponentManifest,
  AppComponentManifestBundle,
  AppComponentReference,
  AppDocumentAccessScope,
  AppManifest,
  AppManifestBundle,
  AppManifestSummary,
  AppPermissions,
  AppPlatformSecuritySummary,
  AppResolvedComponent,
  AppStandaloneManifest,
  AppStandaloneManifestBundle,
} from "#app-runtime/types/app-manifest.types.js";

const PACKAGE_ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const COMPONENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class AppManifestService {
  constructor(
    private readonly platformTargetService = new AppPlatformTargetService(),
  ) {}

  load = async (appDirectory: string): Promise<AppManifestBundle> => {
    const normalizedDirectory = path.resolve(appDirectory);
    const manifestPath = path.join(normalizedDirectory, "manifest.json");
    const rawManifest = JSON.parse(await readFile(manifestPath, "utf-8")) as unknown;
    const manifest = this.parseManifest(rawManifest);
    return manifest.schemaVersion === 1
      ? await this.loadStandaloneBundle(normalizedDirectory, manifestPath, manifest)
      : await this.loadComponentBundle(normalizedDirectory, manifestPath, manifest);
  };

  summarize = (bundle: AppManifestBundle): AppManifestSummary => {
    if (bundle.manifest.schemaVersion === 2) {
      const componentBundle = bundle as AppComponentManifestBundle;
      return {
        schemaVersion: 2,
        id: componentBundle.manifest.id,
        name: componentBundle.manifest.name,
        version: componentBundle.manifest.version,
        description: componentBundle.manifest.description,
        manifestPath: componentBundle.manifestPath,
        iconPath: componentBundle.iconPath,
        primaryPanelId: componentBundle.primaryPanelId,
        components: componentBundle.components,
        distribution: this.platformTargetService.resolveDistribution(
          componentBundle.manifest.distribution,
        ),
        security: this.resolvePlatformSecurity(componentBundle.manifest),
      };
    }
    const standaloneBundle = bundle as AppStandaloneManifestBundle;
    const permissions = standaloneBundle.manifest.permissions ?? {};
    return {
      schemaVersion: 1,
      id: standaloneBundle.manifest.id,
      name: standaloneBundle.manifest.name,
      version: standaloneBundle.manifest.version,
      description: standaloneBundle.manifest.description,
      mainKind: standaloneBundle.manifest.main.kind,
      action:
        standaloneBundle.manifest.main.kind === "wasm"
          ? standaloneBundle.manifest.main.action
          : undefined,
      manifestPath: standaloneBundle.manifestPath,
      mainEntryPath: standaloneBundle.mainEntryPath,
      uiEntryPath: standaloneBundle.uiEntryPath,
      iconPath: standaloneBundle.iconPath,
      permissions,
    };
  };

  private loadStandaloneBundle = async (
    appDirectory: string,
    manifestPath: string,
    manifest: AppStandaloneManifest,
  ): Promise<AppStandaloneManifestBundle> => {
    const mainEntryPath = await this.assertResolvedFile(
      appDirectory,
      manifest.main.entry,
      "main.entry",
    );
    const uiEntryPath = await this.assertResolvedFile(
      appDirectory,
      manifest.ui.entry,
      "ui.entry",
    );
    const iconPath = manifest.icon
      ? await this.assertResolvedFile(appDirectory, manifest.icon, "icon")
      : undefined;
    return {
      appDirectory,
      manifestPath,
      manifest,
      mainEntryPath,
      uiEntryPath,
      uiDirectoryPath: path.dirname(uiEntryPath),
      assetsDirectoryPath: path.join(appDirectory, "assets"),
      iconPath,
    };
  };

  private loadComponentBundle = async (
    appDirectory: string,
    manifestPath: string,
    manifest: AppComponentManifest,
  ): Promise<AppComponentManifestBundle> => {
    const components: AppResolvedComponent[] = [];
    for (const [index, component] of manifest.components.entries()) {
      const componentDirectory = await this.assertResolvedDirectory(
        appDirectory,
        component.path,
        `components[${index}].path`,
      );
      const componentId = await this.readComponentId(component, componentDirectory);
      const expectedPrefix = `${manifest.id.replace(/[^a-z0-9]+/g, "-")}-`;
      if (!componentId.startsWith(expectedPrefix)) {
        throw new Error(
          `组件 ${componentId} 必须使用包前缀 ${expectedPrefix}。`,
        );
      }
      components.push({
        ...component,
        id: componentId,
        componentDirectory,
        manifestPath: path.join(
          componentDirectory,
          component.kind === "panel" ? "panel-app.json" : "service-app.json",
        ),
      });
    }
    const duplicateId = components.find(
      (component, index) => components.findIndex((entry) => entry.id === component.id) !== index,
    );
    if (duplicateId) {
      throw new Error(`components 包含重复组件 id：${duplicateId.id}`);
    }
    const panelIds = components
      .filter((component) => component.kind === "panel")
      .map((component) => component.id);
    const declaredPrimaryPanel = manifest.presentation?.primaryPanel;
    if (declaredPrimaryPanel && !panelIds.includes(declaredPrimaryPanel)) {
      throw new Error("presentation.primaryPanel 必须引用真实 Panel component id。");
    }
    if (panelIds.length > 1 && !declaredPrimaryPanel) {
      throw new Error("包含多个 Panel 时必须声明 presentation.primaryPanel。");
    }
    if (panelIds.length === 0 && declaredPrimaryPanel) {
      throw new Error("不含 Panel 的包不能声明 presentation.primaryPanel。");
    }
    const iconPath = manifest.icon
      ? await this.assertResolvedFile(appDirectory, manifest.icon, "icon")
      : undefined;
    return {
      appDirectory,
      manifestPath,
      manifest,
      components,
      assetsDirectoryPath: path.join(appDirectory, "assets"),
      iconPath,
      primaryPanelId: declaredPrimaryPanel ?? panelIds[0],
    };
  };

  private parseManifest = (rawManifest: unknown): AppManifest => {
    const candidate = this.assertObject(rawManifest, "manifest.json");
    const schemaVersion = this.readNumber(candidate.schemaVersion, "schemaVersion");
    if (schemaVersion !== 1 && schemaVersion !== 2) {
      throw new Error("当前只支持 schemaVersion = 1 或 2。");
    }
    const common = this.parseCommonManifest(candidate);
    if (schemaVersion === 1) {
      return {
        schemaVersion: 1,
        ...common,
        main: this.parseMain(candidate.main),
        ui: this.parseUi(candidate.ui),
        permissions: this.parsePermissions(candidate.permissions),
      };
    }
    const components = this.parseComponents(candidate.components);
    const runtime = this.parseRuntime(candidate.runtime);
    this.assertRuntimeMatchesComponents(runtime, components);
    return {
      schemaVersion: 2,
      ...common,
      engines: this.parseEngines(candidate.engines),
      presentation: this.parsePresentation(candidate.presentation),
      runtime,
      distribution: this.platformTargetService.parseDistribution(candidate.distribution),
      storage: this.parseAppStorage(candidate.storage),
      permissions: this.parsePermissions(candidate.permissions),
      components,
    };
  };

  resolvePlatformSecurity = (
    manifest: AppComponentManifest,
  ): AppPlatformSecuritySummary => {
    const hasServiceComponents = manifest.components.some(
      (component) => component.kind === "service",
    );
    const runtimeProfile = manifest.runtime?.profile ?? (
      hasServiceComponents ? "native-process" : "panel-only"
    );
    const isolation = runtimeProfile === "panel-only"
      ? "sandboxed"
      : runtimeProfile === "wasi"
        ? "host-mediated"
        : "full-user";
    const declaredPermissions = manifest.permissions ?? {};
    const permissions: AppPermissions = runtimeProfile === "native-process"
      ? {
          ...declaredPermissions,
          storage: declaredPermissions.storage ?? true,
          capabilities: {
            ...declaredPermissions.capabilities,
            nativeProcess: true,
          },
        }
      : declaredPermissions;
    return {
      runtimeProfile,
      isolation,
      hasServiceComponents,
      inferred: manifest.runtime === undefined,
      permissions,
    };
  };

  private parseCommonManifest = (candidate: Record<string, unknown>) => {
    const id = this.readRequiredString(candidate.id, "id");
    if (!PACKAGE_ID_PATTERN.test(id)) {
      throw new Error("id 必须由小写字母、数字、点或连字符组成。");
    }
    return {
      id,
      name: this.readRequiredString(candidate.name, "name"),
      version: this.readRequiredString(candidate.version, "version"),
      description: this.readOptionalString(candidate.description, "description"),
      icon: this.readOptionalString(candidate.icon, "icon"),
    };
  };

  private parseMain = (rawMain: unknown): AppStandaloneManifest["main"] => {
    const candidate = this.assertObject(rawMain, "main");
    const kind = this.readRequiredString(candidate.kind, "main.kind");
    if (kind === "wasm") {
      return {
        kind,
        entry: this.readRequiredString(candidate.entry, "main.entry"),
        export: this.readRequiredString(candidate.export, "main.export"),
        action: this.readRequiredString(candidate.action, "main.action"),
      };
    }
    if (kind === "wasi-http-component") {
      return {
        kind,
        entry: this.readRequiredString(candidate.entry, "main.entry"),
      };
    }
    throw new Error("当前 main.kind 只支持 wasm 或 wasi-http-component。");
  };

  private parseUi = (rawUi: unknown): AppStandaloneManifest["ui"] => {
    const candidate = this.assertObject(rawUi, "ui");
    return { entry: this.readRequiredString(candidate.entry, "ui.entry") };
  };

  private parseComponents = (rawComponents: unknown): AppComponentReference[] => {
    if (!Array.isArray(rawComponents) || rawComponents.length === 0) {
      throw new Error("components 必须是非空数组。");
    }
    const components = rawComponents.map((rawComponent, index) => {
      const candidate = this.assertObject(rawComponent, `components[${index}]`);
      const kind = this.readRequiredString(candidate.kind, `components[${index}].kind`);
      if (kind !== "panel" && kind !== "service") {
        throw new Error(`components[${index}].kind 只支持 panel 或 service。`);
      }
      const normalizedKind: AppComponentReference["kind"] = kind;
      return {
        kind: normalizedKind,
        path: this.normalizeRelativePath(
          this.readRequiredString(candidate.path, `components[${index}].path`),
          `components[${index}].path`,
        ),
      };
    });
    for (let leftIndex = 0; leftIndex < components.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < components.length; rightIndex += 1) {
        const left = components[leftIndex]?.path;
        const right = components[rightIndex]?.path;
        if (left && right && (left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`))) {
          throw new Error(`components path 不能重复或重叠：${left} / ${right}`);
        }
      }
    }
    return components;
  };

  private parseEngines = (
    rawEngines: unknown,
  ): AppComponentManifest["engines"] => {
    if (rawEngines === undefined) {
      return undefined;
    }
    const candidate = this.assertObject(rawEngines, "engines");
    return { nextclaw: this.readOptionalString(candidate.nextclaw, "engines.nextclaw") };
  };

  private parsePresentation = (
    rawPresentation: unknown,
  ): AppComponentManifest["presentation"] => {
    if (rawPresentation === undefined) {
      return undefined;
    }
    const candidate = this.assertObject(rawPresentation, "presentation");
    return {
      primaryPanel: this.readOptionalString(
        candidate.primaryPanel,
        "presentation.primaryPanel",
      ),
    };
  };

  private parseRuntime = (
    rawRuntime: unknown,
  ): AppComponentManifest["runtime"] => {
    if (rawRuntime === undefined) {
      return undefined;
    }
    const candidate = this.assertObject(rawRuntime, "runtime");
    const profile = this.readRequiredString(candidate.profile, "runtime.profile");
    if (profile !== "panel-only" && profile !== "wasi" && profile !== "native-process") {
      throw new Error("runtime.profile 只支持 panel-only、wasi 或 native-process。");
    }
    return { profile };
  };

  private parseAppStorage = (
    rawStorage: unknown,
  ): AppComponentManifest["storage"] => {
    if (rawStorage === undefined) {
      return undefined;
    }
    const candidate = this.assertObject(rawStorage, "storage");
    const scope = this.readRequiredString(candidate.scope, "storage.scope");
    if (scope !== "global") {
      throw new Error("当前 storage.scope 只支持 global。");
    }
    const schemaVersion = this.readNumber(candidate.schemaVersion, "storage.schemaVersion");
    if (!Number.isSafeInteger(schemaVersion) || schemaVersion < 1) {
      throw new Error("storage.schemaVersion 必须是正整数。");
    }
    return { scope, schemaVersion };
  };

  private assertRuntimeMatchesComponents = (
    runtime: AppComponentManifest["runtime"],
    components: AppComponentReference[],
  ): void => {
    if (!runtime) {
      return;
    }
    const hasService = components.some((component) => component.kind === "service");
    if (runtime.profile === "panel-only" && hasService) {
      throw new Error("runtime.profile=panel-only 不能包含 Service component。");
    }
    if (runtime.profile === "wasi") {
      if (!hasService) {
        throw new Error("wasi runtime 必须包含 Service component。");
      }
      return;
    }
    if (runtime.profile !== "panel-only" && !hasService) {
      throw new Error(`${runtime.profile} runtime 必须包含 Service component。`);
    }
  };

  private readComponentId = async (
    component: AppComponentReference,
    componentDirectory: string,
  ): Promise<string> => {
    const manifestFile = component.kind === "panel" ? "panel-app.json" : "service-app.json";
    const raw = JSON.parse(
      await readFile(path.join(componentDirectory, manifestFile), "utf-8"),
    ) as unknown;
    const manifest = this.assertObject(raw, `${component.path}/${manifestFile}`);
    const id = this.readRequiredString(manifest.id, `${component.path}/${manifestFile}.id`);
    if (!COMPONENT_ID_PATTERN.test(id)) {
      throw new Error(`组件 id 必须是 kebab-case：${id}`);
    }
    const directoryName = path.basename(componentDirectory);
    const expectedId = component.kind === "panel"
      ? directoryName.replace(/\.panel$/, "")
      : directoryName;
    if (component.kind === "panel" && !directoryName.endsWith(".panel")) {
      throw new Error(`Panel component 目录必须以 .panel 结尾：${component.path}`);
    }
    if (id !== expectedId) {
      throw new Error(`组件 id 必须与目录名一致：期望 ${expectedId}，实际 ${id}`);
    }
    return id;
  };

  private parsePermissions = (rawPermissions: unknown): AppPermissions | undefined => {
    if (rawPermissions === undefined) {
      return undefined;
    }
    const candidate = this.assertObject(rawPermissions, "permissions");
    return {
      documentAccess: this.parseDocumentAccess(candidate.documentAccess),
      allowedDomains: this.parseStringArray(candidate.allowedDomains, "permissions.allowedDomains"),
      storage: this.parseStorage(candidate.storage),
      capabilities: this.parseCapabilities(candidate.capabilities),
    };
  };

  private parseDocumentAccess = (rawDocumentAccess: unknown): AppDocumentAccessScope[] | undefined => {
    if (rawDocumentAccess === undefined) {
      return undefined;
    }
    if (!Array.isArray(rawDocumentAccess)) {
      throw new Error("permissions.documentAccess 必须是数组。");
    }
    return rawDocumentAccess.map((scope, index) => {
      const candidate = this.assertObject(scope, `permissions.documentAccess[${index}]`);
      const mode = this.readRequiredString(candidate.mode, `permissions.documentAccess[${index}].mode`);
      if (mode !== "read" && mode !== "read-write") {
        throw new Error(`permissions.documentAccess[${index}].mode 只支持 read 或 read-write。`);
      }
      return {
        id: this.readRequiredString(candidate.id, `permissions.documentAccess[${index}].id`),
        mode,
        description: this.readOptionalString(
          candidate.description,
          `permissions.documentAccess[${index}].description`,
        ),
      };
    });
  };

  private parseStringArray = (rawValue: unknown, fieldName: string): string[] | undefined => {
    if (rawValue === undefined) {
      return undefined;
    }
    if (!Array.isArray(rawValue)) {
      throw new Error(`${fieldName} 必须是字符串数组。`);
    }
    return rawValue.map((item, index) => this.readRequiredString(item, `${fieldName}[${index}]`));
  };

  private parseStorage = (rawStorage: unknown): AppPermissions["storage"] | undefined => {
    if (rawStorage === undefined || typeof rawStorage === "boolean") {
      return rawStorage;
    }
    const candidate = this.assertObject(rawStorage, "permissions.storage");
    return { namespace: this.readOptionalString(candidate.namespace, "permissions.storage.namespace") };
  };

  private parseCapabilities = (rawCapabilities: unknown): AppPermissions["capabilities"] | undefined => {
    if (rawCapabilities === undefined) {
      return undefined;
    }
    const candidate = this.assertObject(rawCapabilities, "permissions.capabilities");
    return {
      hostBridge: candidate.hostBridge === undefined
        ? undefined
        : this.readBoolean(candidate.hostBridge, "permissions.capabilities.hostBridge"),
      nativeProcess: candidate.nativeProcess === undefined
        ? undefined
        : this.readBoolean(candidate.nativeProcess, "permissions.capabilities.nativeProcess"),
    };
  };

  private assertResolvedFile = async (
    appDirectory: string,
    relativePath: string,
    fieldName: string,
  ): Promise<string> => {
    const resolvedPath = this.resolveInside(appDirectory, relativePath, fieldName);
    const stats = await lstat(resolvedPath);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      throw new Error(`${fieldName} 必须指向包内普通文件。`);
    }
    return resolvedPath;
  };

  private assertResolvedDirectory = async (
    appDirectory: string,
    relativePath: string,
    fieldName: string,
  ): Promise<string> => {
    const resolvedPath = this.resolveInside(appDirectory, relativePath, fieldName);
    const stats = await lstat(resolvedPath);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw new Error(`${fieldName} 必须指向包内普通目录。`);
    }
    await access(resolvedPath);
    return resolvedPath;
  };

  private resolveInside = (appDirectory: string, relativePath: string, fieldName: string): string => {
    const normalizedPath = this.normalizeRelativePath(relativePath, fieldName);
    const resolvedPath = path.resolve(appDirectory, normalizedPath);
    const relative = path.relative(appDirectory, resolvedPath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`${fieldName} 不能指向应用目录之外。`);
    }
    return resolvedPath;
  };

  private normalizeRelativePath = (relativePath: string, fieldName: string): string => {
    if (path.isAbsolute(relativePath) || relativePath.includes("\0")) {
      throw new Error(`${fieldName} 必须使用包内相对路径。`);
    }
    const segments = relativePath.replace(/\\/g, "/").split("/");
    if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
      throw new Error(`${fieldName} 包含非法路径片段。`);
    }
    return segments.join("/");
  };

  private assertObject = (value: unknown, fieldName: string): Record<string, unknown> => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${fieldName} 必须是对象。`);
    }
    return value as Record<string, unknown>;
  };

  private readRequiredString = (value: unknown, fieldName: string): string => {
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`${fieldName} 必须是非空字符串。`);
    }
    return value.trim();
  };

  private readOptionalString = (value: unknown, fieldName: string): string | undefined => {
    return value === undefined ? undefined : this.readRequiredString(value, fieldName);
  };

  private readNumber = (value: unknown, fieldName: string): number => {
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new Error(`${fieldName} 必须是数字。`);
    }
    return value;
  };

  private readBoolean = (value: unknown, fieldName: string): boolean => {
    if (typeof value !== "boolean") {
      throw new Error(`${fieldName} 必须是布尔值。`);
    }
    return value;
  };
}
