import { DomainValidationError } from "../../domain/errors";
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
    return {
      requireExisting: Boolean(candidate.requireExisting),
      slug: this.readSlug(candidate.slug, "slug"),
      appId: this.readString(candidate.appId, "appId"),
      name: this.readString(candidate.name, "name"),
      version: this.readString(candidate.version, "version"),
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
      manifest: this.readManifest(candidate.manifest),
      permissions: this.readPermissions(candidate.permissions),
      distributionMode: this.readDistributionMode(candidate.distributionMode),
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

  private readManifest = (value: unknown): MarketplaceAppManifest => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new DomainValidationError("manifest must be an object");
    }
    const candidate = value as Record<string, unknown>;
    if (candidate.schemaVersion !== 1) {
      throw new DomainValidationError("manifest.schemaVersion must be 1");
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

  private readMainManifest = (
    kind: string,
    mainCandidate: Record<string, unknown>,
  ): MarketplaceAppManifest["main"] => {
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
