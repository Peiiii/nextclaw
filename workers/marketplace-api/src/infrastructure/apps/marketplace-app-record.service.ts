import { DomainValidationError } from "../../domain/errors";
import type {
  AppInstallSpec,
  AppPublisher,
  MarketplaceAppItemDetail,
  MarketplaceAppItemRow,
  MarketplaceAppItemSummary,
  MarketplaceAppManifest,
  MarketplaceAppVersionRow,
} from "./app-marketplace.types";
import {
  OFFICIAL_APPS_REGISTRY_METADATA_URL,
  OFFICIAL_APPS_WEB_BASE_URL,
} from "./app-marketplace.types";

export class MarketplaceAppRecordMapper {
  mapItemSummary = (row: MarketplaceAppItemRow): MarketplaceAppItemSummary => {
    return {
      id: row.id,
      slug: row.slug,
      appId: row.app_id,
      name: row.name,
      summary: row.summary,
      summaryI18n: this.parseLocalizedMap(row.summary_i18n, `${row.slug}.summary_i18n`, row.summary),
      tags: this.parseStringArray(row.tags, `${row.slug}.tags`),
      author: row.author,
      updatedAt: row.updated_at,
      latestVersion: row.latest_version,
      featured: row.featured === 1,
      publisher: this.readPublisher(row),
      install: this.buildInstallSpec(row.app_id),
      webUrl: `${OFFICIAL_APPS_WEB_BASE_URL}/apps/${row.slug}`,
    };
  };

  mapItemDetail = (
    row: MarketplaceAppItemRow,
    versionRows: MarketplaceAppVersionRow[],
  ): MarketplaceAppItemDetail => {
    return {
      ...this.mapItemSummary(row),
      description: row.description ?? undefined,
      descriptionI18n: row.description
        ? this.parseLocalizedMap(row.description_i18n, `${row.slug}.description_i18n`, row.description)
        : undefined,
      sourceRepo: row.source_repo ?? undefined,
      homepage: row.homepage ?? undefined,
      manifest: this.parseManifest(row.manifest_json, `${row.slug}.manifest_json`),
      permissions: this.parsePermissions(row.permissions_json, `${row.slug}.permissions_json`),
      publishedAt: row.published_at,
      versions: versionRows.map((versionRow) => ({
        version: versionRow.version,
        publishedAt: versionRow.published_at,
        updatedAt: versionRow.updated_at,
        bundleSha256: versionRow.bundle_sha256,
        downloadPath: `/api/v1/apps/items/${encodeURIComponent(row.slug)}/bundles/${encodeURIComponent(versionRow.version)}`,
      })),
    };
  };

  parseManifest = (raw: string, path: string): MarketplaceAppManifest => {
    return this.parseJson(raw, path) as MarketplaceAppManifest;
  };

  parsePermissions = (
    raw: string,
    path: string,
  ): NonNullable<MarketplaceAppManifest["permissions"]> => {
    return this.parseJson(raw, path) as NonNullable<MarketplaceAppManifest["permissions"]>;
  };

  readPublisher = (row: MarketplaceAppItemRow): AppPublisher => {
    return {
      id: row.publisher_id,
      name: row.publisher_name,
      url: row.publisher_url ?? undefined,
    };
  };

  buildInstallSpec = (appId: string): AppInstallSpec => {
    return {
      kind: "registry",
      spec: appId,
      command: `napp install ${appId}`,
      registry: OFFICIAL_APPS_REGISTRY_METADATA_URL,
    };
  };

  private parseLocalizedMap = (
    raw: string | null,
    path: string,
    fallbackEn: string,
  ): Record<string, string> => {
    if (!raw) {
      return {
        en: fallbackEn,
      };
    }
    const parsed = this.parseJson(raw, path);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new DomainValidationError(`${path} must be an object`);
    }
    const localized = Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([locale, text]) => [
        locale,
        this.readString(text, `${path}.${locale}`),
      ]),
    );
    if (!localized.en) {
      localized.en = fallbackEn;
    }
    return localized;
  };

  private parseStringArray = (raw: string, path: string): string[] => {
    const parsed = this.parseJson(raw, path);
    if (!Array.isArray(parsed)) {
      throw new DomainValidationError(`${path} must be an array`);
    }
    return parsed.map((entry, index) => this.readString(entry, `${path}[${index}]`));
  };

  private parseJson = (raw: string, path: string): unknown => {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      throw new DomainValidationError(`${path} must be valid JSON`);
    }
  };

  private readString = (value: unknown, path: string): string => {
    if (typeof value !== "string" || !value.trim()) {
      throw new DomainValidationError(`${path} must be a non-empty string`);
    }
    return value.trim();
  };
}
