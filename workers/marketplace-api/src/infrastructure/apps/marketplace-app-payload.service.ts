import { DomainValidationError } from "@/domain/errors";
import type {
  AppPublisher,
  MarketplaceAppFileInput,
  MarketplaceAppManifest,
  MarketplaceAppPublishInput,
} from "./app-marketplace.types";

export class MarketplaceAppPayloadParser {
  parsePublishInput = (rawInput: unknown): MarketplaceAppPublishInput => {
    if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
      throw new DomainValidationError("body must be an object");
    }
    const candidate = rawInput as Record<string, unknown>;
    const summary = this.readString(candidate.summary, "summary");
    const description = this.readOptionalString(candidate.description, "description");
    const appId = this.readString(candidate.appId, "appId");
    const name = this.readString(candidate.name, "name");
    const version = this.readString(candidate.version, "version");
    const manifest = this.readManifest(candidate.manifest);
    const distributionMode = this.readDistributionMode(candidate.distributionMode);
    if (manifest.id !== appId || manifest.name !== name || manifest.version !== version) {
      throw new DomainValidationError("manifest identity must match appId, name, and version");
    }
    if (manifest.schemaVersion === 2 && distributionMode !== "bundle") {
      throw new DomainValidationError("schema v2 component apps must use bundle distribution");
    }
    return {
      requireExisting: Boolean(candidate.requireExisting),
      slug: this.readSlug(candidate.slug, "slug"),
      appId,
      name,
      version,
      summary,
      summaryI18n: this.readLocalizedMap(candidate.summaryI18n, "summaryI18n", summary),
      description,
      descriptionI18n: description
        ? this.readOptionalLocalizedMap(candidate.descriptionI18n, "descriptionI18n", description)
        : undefined,
      author: this.readString(candidate.author, "author"),
      tags: this.readStringArray(candidate.tags, "tags"),
      sourceRepo: this.readOptionalString(candidate.sourceRepo, "sourceRepo"),
      homepage: this.readOptionalString(candidate.homepage, "homepage"),
      featured: this.readBoolean(candidate.featured, "featured"),
      publisher: this.readPublisherInput(candidate.publisher),
      visuals: this.readVisuals(candidate.visuals),
      manifest,
      permissions: this.resolvePermissions(manifest, candidate.permissions),
      distributionMode,
      bundleBase64: this.readString(candidate.bundleBase64, "bundleBase64"),
      bundleSha256: this.readString(candidate.bundleSha256, "bundleSha256"),
      files: this.readFileInputs(candidate.files),
    };
  };

  decodeBase64 = (raw: string, path: string): Uint8Array => {
    try {
      const binary = atob(raw);
      return Uint8Array.from(binary, (char) => char.charCodeAt(0));
    } catch {
      throw new DomainValidationError(`${path} must be valid base64`);
    }
  };

  private readPublisherInput = (value: unknown): AppPublisher => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new DomainValidationError("publisher must be an object");
    }
    const candidate = value as Record<string, unknown>;
    return {
      id: this.readString(candidate.id, "publisher.id"),
      name: this.readString(candidate.name, "publisher.name"),
      url: this.readOptionalString(candidate.url, "publisher.url"),
    };
  };

  private readVisuals = (
    value: unknown,
  ): MarketplaceAppPublishInput["visuals"] => {
    if (value === undefined) {
      return undefined;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new DomainValidationError("visuals must be an object");
    }
    const candidate = value as Record<string, unknown>;
    const accentColor = this.readString(candidate.accentColor, "visuals.accentColor");
    if (!/^#[0-9a-f]{6}$/i.test(accentColor)) {
      throw new DomainValidationError("visuals.accentColor must be a six-digit hex color");
    }
    return {
      cover: this.readRelativePath(candidate.cover, "visuals.cover"),
      accentColor: accentColor.toUpperCase(),
    };
  };

  private readManifest = (value: unknown): MarketplaceAppManifest => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new DomainValidationError("manifest must be an object");
    }
    const candidate = value as Record<string, unknown>;
    if (candidate.schemaVersion === 2) {
      return this.readComponentManifest(candidate);
    }
    if (candidate.schemaVersion !== 1) {
      throw new DomainValidationError("manifest.schemaVersion must be 1 or 2");
    }
    const main = candidate.main;
    const ui = candidate.ui;
    if (!main || typeof main !== "object" || Array.isArray(main)) {
      throw new DomainValidationError("manifest.main must be an object");
    }
    if (!ui || typeof ui !== "object" || Array.isArray(ui)) {
      throw new DomainValidationError("manifest.ui must be an object");
    }
    const mainCandidate = main as Record<string, unknown>;
    const uiCandidate = ui as Record<string, unknown>;
    const mainKind = this.readString(mainCandidate.kind, "manifest.main.kind");
    return {
      schemaVersion: 1,
      id: this.readString(candidate.id, "manifest.id"),
      name: this.readString(candidate.name, "manifest.name"),
      version: this.readString(candidate.version, "manifest.version"),
      description: this.readOptionalString(candidate.description, "manifest.description"),
      icon: this.readOptionalString(candidate.icon, "manifest.icon"),
      main: this.readMainManifest(mainKind, mainCandidate),
      ui: {
        entry: this.readString(uiCandidate.entry, "manifest.ui.entry"),
      },
      permissions: this.readPermissions(candidate.permissions),
    };
  };

  private readComponentManifest = (
    candidate: Record<string, unknown>,
  ): Extract<MarketplaceAppManifest, { schemaVersion: 2 }> => {
    const components = this.readComponentReferences(candidate.components);
    const engines = this.readOptionalRecord(candidate.engines, "manifest.engines");
    const presentation = this.readOptionalRecord(candidate.presentation, "manifest.presentation");
    const nextclawEngine = engines
      ? this.readOptionalString(engines.nextclaw, "manifest.engines.nextclaw")
      : undefined;
    const primaryPanel = presentation
      ? this.readOptionalString(presentation.primaryPanel, "manifest.presentation.primaryPanel")
      : undefined;
    const hasService = components.some((component) => component.kind === "service");
    const runtimeProfile = this.readRuntimeProfile(candidate.runtime, hasService);
    const storage = this.readOptionalRecord(candidate.storage, "manifest.storage");
    const storageScope = storage
      ? this.readString(storage.scope, "manifest.storage.scope")
      : undefined;
    const storageSchemaVersion = storage?.schemaVersion;
    if (storageScope !== undefined && storageScope !== "global") {
      throw new DomainValidationError("manifest.storage.scope must be global");
    }
    if (
      storageSchemaVersion !== undefined &&
      (typeof storageSchemaVersion !== "number" ||
        !Number.isSafeInteger(storageSchemaVersion) ||
        storageSchemaVersion < 1)
    ) {
      throw new DomainValidationError("manifest.storage.schemaVersion must be a positive integer");
    }
    return {
      schemaVersion: 2,
      id: this.readString(candidate.id, "manifest.id"),
      name: this.readString(candidate.name, "manifest.name"),
      version: this.readString(candidate.version, "manifest.version"),
      description: this.readOptionalString(candidate.description, "manifest.description"),
      icon: this.readOptionalString(candidate.icon, "manifest.icon"),
      engines: nextclawEngine ? { nextclaw: nextclawEngine } : undefined,
      presentation: primaryPanel ? { primaryPanel } : undefined,
      runtime: runtimeProfile
        ? { profile: runtimeProfile }
        : undefined,
      storage: storageScope && typeof storageSchemaVersion === "number"
        ? { scope: storageScope, schemaVersion: storageSchemaVersion }
        : undefined,
      permissions: this.readPermissions(candidate.permissions),
      components,
    };
  };

  private readRuntimeProfile = (
    rawRuntime: unknown,
    hasService: boolean,
  ): "panel-only" | "wasi" | "native-process" | undefined => {
    const runtime = this.readOptionalRecord(rawRuntime, "manifest.runtime");
    const runtimeProfile = runtime
      ? this.readString(runtime.profile, "manifest.runtime.profile")
      : undefined;
    if (
      runtimeProfile !== undefined &&
      runtimeProfile !== "panel-only" &&
      runtimeProfile !== "wasi" &&
      runtimeProfile !== "native-process"
    ) {
      throw new DomainValidationError(
        "manifest.runtime.profile must be panel-only, wasi, or native-process",
      );
    }
    if (runtimeProfile === "panel-only" && hasService) {
      throw new DomainValidationError("panel-only apps cannot contain service components");
    }
    if (runtimeProfile && runtimeProfile !== "panel-only" && !hasService) {
      throw new DomainValidationError(`${runtimeProfile} apps must contain a service component`);
    }
    return runtimeProfile;
  };

  private readComponentReferences = (
    rawComponents: unknown,
  ): Array<{ kind: "panel" | "service"; path: string }> => {
    if (!Array.isArray(rawComponents) || rawComponents.length === 0) {
      throw new DomainValidationError("manifest.components must be a non-empty array");
    }
    const paths = new Set<string>();
    return rawComponents.map((rawComponent, index) => {
      if (!rawComponent || typeof rawComponent !== "object" || Array.isArray(rawComponent)) {
        throw new DomainValidationError(`manifest.components[${index}] must be an object`);
      }
      const component = rawComponent as Record<string, unknown>;
      const kind = this.readString(component.kind, `manifest.components[${index}].kind`);
      if (kind !== "panel" && kind !== "service") {
        throw new DomainValidationError(
          `manifest.components[${index}].kind must be panel or service`,
        );
      }
      const componentPath = this.readRelativePath(
        component.path,
        `manifest.components[${index}].path`,
      );
      if (paths.has(componentPath)) {
        throw new DomainValidationError(
          `manifest.components contains duplicate path: ${componentPath}`,
        );
      }
      paths.add(componentPath);
      return { kind, path: componentPath };
    });
  };

  private resolvePermissions = (
    manifest: MarketplaceAppManifest,
    rawPermissions: unknown,
  ): NonNullable<MarketplaceAppManifest["permissions"]> => {
    const submittedPermissions = this.readPermissions(rawPermissions);
    const permissions = manifest.schemaVersion === 2
      ? {
          ...submittedPermissions,
          ...manifest.permissions,
          capabilities: {
            ...submittedPermissions.capabilities,
            ...manifest.permissions?.capabilities,
          },
        }
      : submittedPermissions;
    if (manifest.schemaVersion !== 2) {
      return permissions;
    }
    const hasService = manifest.components.some((component) => component.kind === "service");
    const runtimeProfile = manifest.runtime?.profile ?? (
      hasService ? "native-process" : "panel-only"
    );
    if (runtimeProfile !== "native-process") {
      return permissions;
    }
    return {
      ...permissions,
      storage: permissions.storage ?? true,
      capabilities: {
        ...permissions.capabilities,
        nativeProcess: true,
      },
    };
  };

  private readMainManifest = (
    kind: string,
    mainCandidate: Record<string, unknown>,
  ): Extract<MarketplaceAppManifest, { schemaVersion: 1 }>["main"] => {
    if (kind === "wasm") {
      return {
        kind: "wasm",
        entry: this.readString(mainCandidate.entry, "manifest.main.entry"),
        export: this.readString(mainCandidate.export, "manifest.main.export"),
        action: this.readString(mainCandidate.action, "manifest.main.action"),
      };
    }
    if (kind === "wasi-http-component") {
      return {
        kind: "wasi-http-component",
        entry: this.readString(mainCandidate.entry, "manifest.main.entry"),
      };
    }
    throw new DomainValidationError("manifest.main.kind must be wasm or wasi-http-component");
  };

  private readPermissions = (value: unknown): NonNullable<MarketplaceAppManifest["permissions"]> => {
    if (value === undefined) {
      return {};
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new DomainValidationError("permissions must be an object");
    }
    return value as NonNullable<MarketplaceAppManifest["permissions"]>;
  };

  private readOptionalRecord = (
    value: unknown,
    path: string,
  ): Record<string, unknown> | undefined => {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value !== "object" || Array.isArray(value)) {
      throw new DomainValidationError(`${path} must be an object`);
    }
    return value as Record<string, unknown>;
  };

  private readRelativePath = (value: unknown, fieldPath: string): string => {
    const relativePath = this.readString(value, fieldPath).replace(/\\/g, "/");
    const segments = relativePath.split("/");
    if (
      relativePath.startsWith("/") ||
      /^[A-Za-z]:/.test(relativePath) ||
      segments.some((segment) => !segment || segment === "." || segment === "..")
    ) {
      throw new DomainValidationError(`${fieldPath} must be a safe relative path`);
    }
    return segments.join("/");
  };

  private readFileInputs = (value: unknown): MarketplaceAppFileInput[] => {
    if (!Array.isArray(value) || value.length === 0) {
      throw new DomainValidationError("files must be a non-empty array");
    }
    return value.map((entry, index) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        throw new DomainValidationError(`files[${index}] must be an object`);
      }
      const candidate = entry as Record<string, unknown>;
      return {
        path: this.readString(candidate.path, `files[${index}].path`),
        contentBase64: this.readString(candidate.contentBase64, `files[${index}].contentBase64`),
      };
    });
  };

  private readLocalizedMap = (
    value: unknown,
    path: string,
    fallbackEn: string,
  ): Record<string, string> => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new DomainValidationError(`${path} must be an object`);
    }
    const localized = Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([locale, text]) => [
        locale,
        this.readString(text, `${path}.${locale}`),
      ]),
    );
    if (!localized.en) {
      localized.en = fallbackEn;
    }
    return localized;
  };

  private readOptionalLocalizedMap = (
    value: unknown,
    path: string,
    fallbackEn: string,
  ): Record<string, string> | undefined => {
    if (value === undefined) {
      return undefined;
    }
    return this.readLocalizedMap(value, path, fallbackEn);
  };

  private readStringArray = (value: unknown, path: string): string[] => {
    if (!Array.isArray(value) || value.length === 0) {
      throw new DomainValidationError(`${path} must be a non-empty array`);
    }
    return value.map((entry, index) => this.readString(entry, `${path}[${index}]`));
  };

  private readString = (value: unknown, path: string): string => {
    if (typeof value !== "string" || !value.trim()) {
      throw new DomainValidationError(`${path} must be a non-empty string`);
    }
    return value.trim();
  };

  private readOptionalString = (value: unknown, path: string): string | undefined => {
    if (value === undefined || value === null) {
      return undefined;
    }
    return this.readString(value, path);
  };

  private readBoolean = (value: unknown, path: string): boolean => {
    if (typeof value !== "boolean") {
      throw new DomainValidationError(`${path} must be a boolean`);
    }
    return value;
  };

  private readDistributionMode = (value: unknown): "bundle" | "source" => {
    const mode = this.readString(value, "distributionMode");
    if (mode !== "bundle" && mode !== "source") {
      throw new DomainValidationError("distributionMode must be bundle or source");
    }
    return mode;
  };

  private readSlug = (value: unknown, path: string): string => {
    const slug = this.readString(value, path);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new DomainValidationError(`${path} must be kebab-case`);
    }
    return slug;
  };
}
