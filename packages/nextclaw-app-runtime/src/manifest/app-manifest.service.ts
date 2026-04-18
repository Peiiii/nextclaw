import { access, readFile } from "node:fs/promises";
import path from "node:path";
import type {
  AppDocumentAccessScope,
  AppManifest,
  AppManifestBundle,
  AppManifestSummary,
  AppPermissions,
} from "./app-manifest.types.js";

export class AppManifestService {
  load = async (appDirectory: string): Promise<AppManifestBundle> => {
    const normalizedDirectory = path.resolve(appDirectory);
    const manifestPath = path.join(normalizedDirectory, "manifest.json");
    const rawManifest = JSON.parse(await readFile(manifestPath, "utf-8")) as unknown;
    const manifest = this.parseManifest(rawManifest);
    const mainEntryPath = await this.assertResolvedFile(
      normalizedDirectory,
      manifest.main.entry,
      "main.entry",
    );
    const uiEntryPath = await this.assertResolvedFile(
      normalizedDirectory,
      manifest.ui.entry,
      "ui.entry",
    );
    const uiDirectoryPath = path.dirname(uiEntryPath);
    const assetsDirectoryPath = path.join(normalizedDirectory, "assets");
    const iconPath = manifest.icon
      ? await this.assertResolvedFile(normalizedDirectory, manifest.icon, "icon")
      : undefined;

    return {
      appDirectory: normalizedDirectory,
      manifestPath,
      manifest,
      mainEntryPath,
      uiEntryPath,
      uiDirectoryPath,
      assetsDirectoryPath,
      iconPath,
    };
  };

  summarize = (bundle: AppManifestBundle): AppManifestSummary => {
    const permissions = bundle.manifest.permissions ?? {};
    return {
      id: bundle.manifest.id,
      name: bundle.manifest.name,
      version: bundle.manifest.version,
      description: bundle.manifest.description,
      action: bundle.manifest.main.action,
      manifestPath: bundle.manifestPath,
      mainEntryPath: bundle.mainEntryPath,
      uiEntryPath: bundle.uiEntryPath,
      iconPath: bundle.iconPath,
      permissions,
    };
  };

  private parseManifest = (rawManifest: unknown): AppManifest => {
    if (!rawManifest || typeof rawManifest !== "object" || Array.isArray(rawManifest)) {
      throw new Error("manifest.json 必须是一个对象。");
    }

    const candidate = rawManifest as Record<string, unknown>;
    const schemaVersion = this.readNumber(candidate.schemaVersion, "schemaVersion");
    if (schemaVersion !== 1) {
      throw new Error("当前只支持 schemaVersion = 1。");
    }

    const permissions = this.parsePermissions(candidate.permissions);

    return {
      schemaVersion: 1,
      id: this.readRequiredString(candidate.id, "id"),
      name: this.readRequiredString(candidate.name, "name"),
      version: this.readRequiredString(candidate.version, "version"),
      description: this.readOptionalString(candidate.description, "description"),
      icon: this.readOptionalString(candidate.icon, "icon"),
      main: this.parseMain(candidate.main),
      ui: this.parseUi(candidate.ui),
      permissions,
    };
  };

  private parseMain = (rawMain: unknown): AppManifest["main"] => {
    const candidate = this.assertObject(rawMain, "main");
    const kind = this.readRequiredString(candidate.kind, "main.kind");
    if (kind !== "wasm") {
      throw new Error("当前 main.kind 只支持 wasm。");
    }
    return {
      kind: "wasm",
      entry: this.readRequiredString(candidate.entry, "main.entry"),
      export: this.readRequiredString(candidate.export, "main.export"),
      action: this.readRequiredString(candidate.action, "main.action"),
    };
  };

  private parseUi = (rawUi: unknown): AppManifest["ui"] => {
    const candidate = this.assertObject(rawUi, "ui");
    return {
      entry: this.readRequiredString(candidate.entry, "ui.entry"),
    };
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

  private parseDocumentAccess = (
    rawDocumentAccess: unknown,
  ): AppDocumentAccessScope[] | undefined => {
    if (rawDocumentAccess === undefined) {
      return undefined;
    }
    if (!Array.isArray(rawDocumentAccess)) {
      throw new Error("permissions.documentAccess 必须是数组。");
    }
    return rawDocumentAccess.map((scope, index) => {
      const candidate = this.assertObject(scope, `permissions.documentAccess[${index}]`);
      const mode = this.readRequiredString(
        candidate.mode,
        `permissions.documentAccess[${index}].mode`,
      );
      if (mode !== "read" && mode !== "read-write") {
        throw new Error(
          `permissions.documentAccess[${index}].mode 只支持 read 或 read-write。`,
        );
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

  private parseStringArray = (
    rawValue: unknown,
    fieldName: string,
  ): string[] | undefined => {
    if (rawValue === undefined) {
      return undefined;
    }
    if (!Array.isArray(rawValue)) {
      throw new Error(`${fieldName} 必须是字符串数组。`);
    }
    return rawValue.map((item, index) =>
      this.readRequiredString(item, `${fieldName}[${index}]`),
    );
  };

  private parseStorage = (
    rawStorage: unknown,
  ): AppPermissions["storage"] | undefined => {
    if (rawStorage === undefined) {
      return undefined;
    }
    if (typeof rawStorage === "boolean") {
      return rawStorage;
    }
    const candidate = this.assertObject(rawStorage, "permissions.storage");
    return {
      namespace: this.readOptionalString(candidate.namespace, "permissions.storage.namespace"),
    };
  };

  private parseCapabilities = (
    rawCapabilities: unknown,
  ): AppPermissions["capabilities"] | undefined => {
    if (rawCapabilities === undefined) {
      return undefined;
    }
    const candidate = this.assertObject(rawCapabilities, "permissions.capabilities");
    return {
      hostBridge:
        candidate.hostBridge === undefined
          ? undefined
          : this.readBoolean(candidate.hostBridge, "permissions.capabilities.hostBridge"),
    };
  };

  private assertResolvedFile = async (
    appDirectory: string,
    relativePath: string,
    fieldName: string,
  ): Promise<string> => {
    if (path.isAbsolute(relativePath)) {
      throw new Error(`${fieldName} 必须使用应用目录内的相对路径。`);
    }
    const resolvedPath = path.resolve(appDirectory, relativePath);
    const relative = path.relative(appDirectory, resolvedPath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`${fieldName} 不能指向应用目录之外。`);
    }
    await access(resolvedPath);
    return resolvedPath;
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
    if (value === undefined) {
      return undefined;
    }
    return this.readRequiredString(value, fieldName);
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
