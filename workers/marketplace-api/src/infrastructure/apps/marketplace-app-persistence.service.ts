import type { MarketplaceAppPublishInput } from "./app-marketplace.types";

export class MarketplaceAppPersistence {
  constructor(private readonly db: D1Database) {}

  persistVersion = async (params: {
    itemId: string;
    input: MarketplaceAppPublishInput;
    bundleStorageKey: string;
    publishedAt: string;
    updatedAt: string;
  }): Promise<void> => {
    const { itemId, input, bundleStorageKey, publishedAt, updatedAt } = params;
    await this.db
      .prepare(
        `
          INSERT INTO marketplace_app_versions (
            item_id,
            version,
            manifest_json,
            permissions_json,
            description,
            bundle_sha256,
            bundle_storage_key,
            published_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(item_id, version) DO UPDATE SET
            manifest_json = excluded.manifest_json,
            permissions_json = excluded.permissions_json,
            description = excluded.description,
            bundle_sha256 = excluded.bundle_sha256,
            bundle_storage_key = excluded.bundle_storage_key,
            updated_at = excluded.updated_at
        `,
      )
      .bind(
        itemId,
        input.version,
        JSON.stringify(input.manifest),
        JSON.stringify(input.permissions ?? {}),
        input.description ?? null,
        input.bundleSha256,
        bundleStorageKey,
        publishedAt,
        updatedAt,
      )
      .run();
  };

  persistItem = async (params: {
    itemId: string;
    input: MarketplaceAppPublishInput;
    latestVersion: string;
    publishedAt: string;
    updatedAt: string;
  }): Promise<void> => {
    const { itemId, input, latestVersion, publishedAt, updatedAt } = params;
    await this.db
      .prepare(
        `
          INSERT INTO marketplace_app_items (
            id,
            slug,
            app_id,
            name,
            summary,
            summary_i18n,
            description,
            description_i18n,
            tags,
            author,
            source_repo,
            homepage,
            featured,
            publisher_id,
            publisher_name,
            publisher_url,
            latest_version,
            manifest_json,
            permissions_json,
            published_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(app_id) DO UPDATE SET
            slug = excluded.slug,
            name = excluded.name,
            summary = excluded.summary,
            summary_i18n = excluded.summary_i18n,
            description = excluded.description,
            description_i18n = excluded.description_i18n,
            tags = excluded.tags,
            author = excluded.author,
            source_repo = excluded.source_repo,
            homepage = excluded.homepage,
            featured = excluded.featured,
            publisher_id = excluded.publisher_id,
            publisher_name = excluded.publisher_name,
            publisher_url = excluded.publisher_url,
            latest_version = excluded.latest_version,
            manifest_json = excluded.manifest_json,
            permissions_json = excluded.permissions_json,
            updated_at = excluded.updated_at
        `,
      )
      .bind(
        itemId,
        input.slug,
        input.appId,
        input.name,
        input.summary,
        JSON.stringify(input.summaryI18n),
        input.description ?? null,
        input.descriptionI18n ? JSON.stringify(input.descriptionI18n) : null,
        JSON.stringify(input.tags),
        input.author,
        input.sourceRepo ?? null,
        input.homepage ?? null,
        input.featured ? 1 : 0,
        input.publisher.id,
        input.publisher.name,
        input.publisher.url ?? null,
        latestVersion,
        JSON.stringify(input.manifest),
        JSON.stringify(input.permissions ?? {}),
        publishedAt,
        updatedAt,
      )
      .run();
  };
}
