import catalog from "../../data/catalog.json";
import { DomainValidationError } from "../domain/errors";
import type {
  MarketplaceCatalogSection,
  MarketplaceCatalogSnapshot,
  MarketplaceInstallSpec,
  MarketplaceItem,
  MarketplaceItemType,
  MarketplaceRecommendationScene
} from "../domain/model";
import { BaseMarketplaceDataSource } from "./data-source";

type RawRecord = Record<string, unknown>;

export class BundledMarketplaceDataSource extends BaseMarketplaceDataSource {
  async loadSnapshot(): Promise<MarketplaceCatalogSnapshot> {
    return this.parseCatalog(catalog as unknown);
  }

  private parseCatalog(raw: unknown): MarketplaceCatalogSnapshot {
    if (!this.isRawRecord(raw)) {
      throw new DomainValidationError("catalog root must be an object");
    }

    const version = this.readString(raw.version, "catalog.version");
    const generatedAt = this.readString(raw.generatedAt, "catalog.generatedAt");
    const plugins = this.parseSection(raw.plugins, "catalog.plugins", "plugin");
    const skills = this.parseSection(raw.skills, "catalog.skills", "skill");

    return {
      version,
      generatedAt,
      plugins,
      skills
    };
  }

  private parseSection(
    value: unknown,
    path: string,
    expectedType: MarketplaceItemType
  ): MarketplaceCatalogSection {
    if (!this.isRawRecord(value)) {
      throw new DomainValidationError(`${path} must be an object`);
    }

    const items = this.parseItems(value.items, `${path}.items`, expectedType);
    const itemIds = new Set(items.map((item) => item.id));
    const recommendations = this.parseRecommendations(value.recommendations, `${path}.recommendations`, itemIds);

    return {
      items,
      recommendations
    };
  }

  private parseItems(value: unknown, path: string, expectedType: MarketplaceItemType): MarketplaceItem[] {
    if (!Array.isArray(value)) {
      throw new DomainValidationError(`${path} must be an array`);
    }

    return value.map((entry, index) => this.parseItem(entry, `${path}[${index}]`, expectedType));
  }

  private parseItem(raw: unknown, path: string, expectedType: MarketplaceItemType): MarketplaceItem {
    if (!this.isRawRecord(raw)) {
      throw new DomainValidationError(`${path} must be an object`);
    }

    const rawType = this.readString(raw.type, `${path}.type`);
    if (rawType !== expectedType) {
      throw new DomainValidationError(`${path}.type must be ${expectedType}`);
    }
    const type = expectedType;

    return {
      id: this.readString(raw.id, `${path}.id`),
      slug: this.readString(raw.slug, `${path}.slug`),
      type,
      name: this.readString(raw.name, `${path}.name`),
      summary: this.readString(raw.summary, `${path}.summary`),
      description: this.readOptionalString(raw.description, `${path}.description`),
      tags: this.readStringArray(raw.tags, `${path}.tags`),
      author: this.readString(raw.author, `${path}.author`),
      sourceRepo: this.readOptionalString(raw.sourceRepo, `${path}.sourceRepo`),
      homepage: this.readOptionalString(raw.homepage, `${path}.homepage`),
      install: this.parseInstallSpec(raw.install, `${path}.install`),
      publishedAt: this.readString(raw.publishedAt, `${path}.publishedAt`),
      updatedAt: this.readString(raw.updatedAt, `${path}.updatedAt`)
    };
  }

  private parseInstallSpec(value: unknown, path: string): MarketplaceInstallSpec {
    if (!this.isRawRecord(value)) {
      throw new DomainValidationError(`${path} must be an object`);
    }

    const rawKind = this.readString(value.kind, `${path}.kind`);
    if (![
      "npm",
      "clawhub",
      "git",
      "builtin"
    ].includes(rawKind)) {
      throw new DomainValidationError(`${path}.kind is invalid`);
    }
    const kind = rawKind as "npm" | "clawhub" | "git" | "builtin";

    return {
      kind,
      spec: this.readString(value.spec, `${path}.spec`),
      command: this.readString(value.command, `${path}.command`)
    };
  }

  private parseRecommendations(
    value: unknown,
    path: string,
    itemIds: Set<string>
  ): MarketplaceRecommendationScene[] {
    if (!Array.isArray(value)) {
      throw new DomainValidationError(`${path} must be an array`);
    }

    return value.map((entry, index) => {
      if (!this.isRawRecord(entry)) {
        throw new DomainValidationError(`${path}[${index}] must be an object`);
      }

      const recommendation = {
        id: this.readString(entry.id, `${path}[${index}].id`),
        title: this.readString(entry.title, `${path}[${index}].title`),
        description: this.readOptionalString(entry.description, `${path}[${index}].description`),
        itemIds: this.readStringArray(entry.itemIds, `${path}[${index}].itemIds`)
      };

      for (const itemId of recommendation.itemIds) {
        if (!itemIds.has(itemId)) {
          throw new DomainValidationError(`${path}[${index}].itemIds contains unknown item id: ${itemId}`);
        }
      }

      return recommendation;
    });
  }

  private readString(value: unknown, path: string): string {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new DomainValidationError(`${path} must be a non-empty string`);
    }
    return value;
  }

  private readOptionalString(value: unknown, path: string): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    return this.readString(value, path);
  }

  private readStringArray(value: unknown, path: string): string[] {
    if (!Array.isArray(value)) {
      throw new DomainValidationError(`${path} must be an array`);
    }

    return value.map((entry, index) => this.readString(entry, `${path}[${index}]`));
  }

  private isRawRecord(value: unknown): value is RawRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
