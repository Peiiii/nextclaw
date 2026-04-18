import { DomainValidationError } from "../domain/errors";
import type {
  MarketplaceCatalogSection,
  MarketplaceItem,
  MarketplaceItemType,
  MarketplacePluginInstallSpec,
  MarketplaceRecommendationScene,
  MarketplaceSkillInstallSpec
} from "../domain/model";
import { BaseMarketplaceDataSource } from "./data-source";
import type { LocalizedTextMap } from "../domain/model";
import type {
  ItemRow,
  SceneRow,
  TableNames
} from "./skills/d1-section-types";

export abstract class D1MarketplaceSectionDataSourceBase extends BaseMarketplaceDataSource {
  protected constructor(protected readonly db: D1Database) {
    super();
  }

  protected abstract getItemType(): MarketplaceItemType;
  protected abstract getTables(): TableNames;

  loadSection = async (): Promise<MarketplaceCatalogSection> => {
    const tables = this.getTables();
    const itemsResult = await this.db
      .prepare(`
        SELECT
          id,
          slug,
          name,
          summary,
          summary_i18n,
          description,
          description_i18n,
          tags,
          author,
          source_repo,
          homepage,
          install_kind,
          install_spec,
          install_command,
          published_at,
          updated_at
        FROM ${tables.items}
      `)
      .all<ItemRow>();

    const sceneResult = await this.db
      .prepare(`
        SELECT
          s.id AS scene_id,
          s.title,
          s.description,
          i.item_id
        FROM ${tables.scenes} s
        LEFT JOIN ${tables.sceneItems} i ON i.scene_id = s.id
        ORDER BY s.id ASC, i.sort_order ASC
      `)
      .all<SceneRow>();

    const items = (itemsResult.results ?? []).map((row) => this.mapItemRow(row));
    const recommendations = this.mapScenes(sceneResult.results ?? [], items);

    return {
      items,
      recommendations
    };
  };

  protected mapItemRow = (row: ItemRow): MarketplaceItem => {
    const summaryI18n = this.parseLocalizedMap(row.summary_i18n, `marketplace_items.summary_i18n(${row.slug})`, row.summary);
    const description = row.description ?? undefined;
    const descriptionI18n = description
      ? this.parseLocalizedMap(row.description_i18n, `marketplace_items.description_i18n(${row.slug})`, description)
      : undefined;

    const base = {
      id: row.id,
      slug: row.slug,
      name: row.name,
      summary: row.summary,
      summaryI18n,
      description,
      descriptionI18n,
      tags: this.parseStringArray(row.tags, `marketplace_items.tags(${row.slug})`),
      author: row.author,
      sourceRepo: row.source_repo ?? undefined,
      homepage: row.homepage ?? undefined,
      publishedAt: row.published_at,
      updatedAt: row.updated_at
    };

    const type = this.getItemType();
    if (type === "plugin") {
      const install = this.mapInstall("plugin", row.install_kind, row.install_spec, row.install_command, row.slug) as MarketplacePluginInstallSpec;
      return {
        ...base,
        type: "plugin",
        install
      };
    }

    const install = this.mapInstall("skill", row.install_kind, row.install_spec, row.install_command, row.slug) as MarketplaceSkillInstallSpec;
    return {
      ...base,
      type: "skill",
      packageName: row.package_name ?? `@nextclaw/${row.slug}`,
      ownerScope: row.owner_scope ?? "nextclaw",
      skillName: row.skill_name ?? row.slug,
      publishStatus: this.readSkillPublishStatus(row.publish_status),
      publishedByType: this.readSkillPublishedByType(row.published_by_type),
      install
    };
  };

  protected readSkillPublishStatus = (value: string | null | undefined): "pending" | "published" | "rejected" => {
    if (value === "pending" || value === "published" || value === "rejected") {
      return value;
    }
    return "published";
  };

  protected readSkillPublishedByType = (value: string | null | undefined): "admin" | "user" => {
    return value === "user" ? "user" : "admin";
  };

  protected readSkillOwnerVisibility = (value: string | null | undefined): "public" | "hidden" => {
    return value === "hidden" ? "hidden" : "public";
  };

  protected mapScenes = (rows: SceneRow[], items: MarketplaceItem[]): MarketplaceRecommendationScene[] => {
    const itemIds = new Set(items.map((item) => item.id));
    const sceneMap = new Map<string, MarketplaceRecommendationScene>();

    for (const row of rows) {
      let scene = sceneMap.get(row.scene_id);
      if (!scene) {
        scene = {
          id: row.scene_id,
          title: row.title,
          description: row.description ?? undefined,
          itemIds: []
        };
        sceneMap.set(row.scene_id, scene);
      }

      if (row.item_id && itemIds.has(row.item_id)) {
        scene.itemIds.push(row.item_id);
      }
    }

    return [...sceneMap.values()];
  };

  protected mapInstall = (
    type: MarketplaceItemType,
    kind: string,
    spec: string,
    command: string,
    slug: string
  ): MarketplacePluginInstallSpec | MarketplaceSkillInstallSpec => {
    if (type === "plugin") {
      if (kind !== "npm") {
        throw new DomainValidationError(`plugin install.kind must be npm: ${slug}`);
      }
      return {
        kind: "npm",
        spec,
        command
      };
    }

    if (kind !== "builtin" && kind !== "marketplace") {
      throw new DomainValidationError(`skill install.kind must be builtin|marketplace: ${slug}`);
    }

    return {
      kind,
      spec,
      command
    };
  };

  protected parseStringArray = (raw: string, path: string): string[] => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new DomainValidationError(`${path} must be valid JSON array`);
    }

    if (!Array.isArray(parsed)) {
      throw new DomainValidationError(`${path} must be an array`);
    }

    return parsed.map((entry, index) => this.readString(entry, `${path}[${index}]`));
  };

  protected parseLocalizedMap = (raw: string | null, path: string, fallbackEn: string): LocalizedTextMap => {
    if (!raw) {
      return {
        en: fallbackEn,
        zh: fallbackEn
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new DomainValidationError(`${path} must be valid JSON object`);
    }

    return this.readLocalizedTextMap(parsed, path, fallbackEn);
  };

  protected readLocalizedTextMap = (value: unknown, path: string, fallbackEn: string): LocalizedTextMap => {
    const localized: LocalizedTextMap = {};

    if (this.isRecord(value)) {
      for (const [locale, text] of Object.entries(value)) {
        localized[locale] = this.readString(text, `${path}.${locale}`);
      }
    }

    if (!localized.en) {
      localized.en = this.pickLocaleFamilyValue(localized, "en") ?? fallbackEn;
    }
    if (!localized.zh) {
      localized.zh = this.pickLocaleFamilyValue(localized, "zh") ?? localized.en;
    }

    return localized;
  };

  protected pickLocaleFamilyValue = (localized: LocalizedTextMap, localeFamily: string): string | undefined => {
    const normalizedFamily = this.normalizeLocaleTag(localeFamily).split("-")[0];
    if (!normalizedFamily) {
      return undefined;
    }

    let familyMatch: string | undefined;
    for (const [locale, text] of Object.entries(localized)) {
      const normalizedLocale = this.normalizeLocaleTag(locale);
      if (!normalizedLocale) {
        continue;
      }
      if (normalizedLocale === normalizedFamily) {
        return text;
      }
      if (!familyMatch && normalizedLocale.startsWith(`${normalizedFamily}-`)) {
        familyMatch = text;
      }
    }

    return familyMatch;
  };

  protected normalizeLocaleTag = (value: string): string => {
    return value.trim().toLowerCase().replace(/_/g, "-");
  };

  protected readSlug = (value: unknown, path: string): string => {
    const slug = this.readString(value, path);
    if (!/^[A-Za-z0-9._-]+$/.test(slug)) {
      throw new DomainValidationError(`${path} must match /^[A-Za-z0-9._-]+$/`);
    }
    return slug;
  };

  protected readString = (value: unknown, path: string): string => {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new DomainValidationError(`${path} must be a non-empty string`);
    }
    return value.trim();
  };

  protected readOptionalString = (value: unknown, path: string): string | undefined => {
    if (value === undefined || value === null) {
      return undefined;
    }
    return this.readString(value, path);
  };

  protected readOptionalDateTime = (value: unknown, path: string): string | undefined => {
    const text = this.readOptionalString(value, path);
    if (!text) {
      return undefined;
    }
    if (Number.isNaN(Date.parse(text))) {
      throw new DomainValidationError(`${path} must be a valid datetime string`);
    }
    return text;
  };

  protected readStringArray = (value: unknown, path: string): string[] => {
    if (value === undefined || value === null) {
      return [];
    }
    if (!Array.isArray(value)) {
      throw new DomainValidationError(`${path} must be an array`);
    }
    return value.map((entry, index) => this.readString(entry, `${path}[${index}]`));
  };

  protected decodeBase64 = (raw: string, path: string): Uint8Array => {
    let binary: string;
    try {
      binary = atob(raw);
    } catch {
      throw new DomainValidationError(`${path} must be valid base64`);
    }

    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  };

  protected sha256Hex = async (bytes: Uint8Array): Promise<string> => {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const digestBytes = new Uint8Array(digest);
    return [...digestBytes].map((value) => value.toString(16).padStart(2, "0")).join("");
  };

  protected isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  };
}
