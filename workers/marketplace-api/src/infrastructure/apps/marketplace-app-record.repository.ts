import type {
  MarketplaceAppFileRow,
  MarketplaceAppItemRow,
  MarketplaceAppVersionRow,
} from "./app-marketplace.types";

export class MarketplaceAppRecordRepository {
  constructor(private readonly db: D1Database) {}

  getItemRow = async (selector: string): Promise<MarketplaceAppItemRow | null> => {
    return (
      (await this.db
        .prepare(
          `
            SELECT
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
            FROM marketplace_app_items
            WHERE slug = ? OR app_id = ?
            LIMIT 1
          `,
        )
        .bind(selector, selector)
        .first<MarketplaceAppItemRow>()) ?? null
    );
  };

  listVersionRows = async (itemId: string): Promise<MarketplaceAppVersionRow[]> => {
    const result = await this.db
      .prepare(
        `
          SELECT
            item_id,
            version,
            manifest_json,
            permissions_json,
            description,
            bundle_sha256,
            bundle_storage_key,
            published_at,
            updated_at
          FROM marketplace_app_versions
          WHERE item_id = ?
          ORDER BY published_at DESC, version DESC
        `,
      )
      .bind(itemId)
      .all<MarketplaceAppVersionRow>();
    return result.results ?? [];
  };

  listFileRows = async (itemId: string): Promise<MarketplaceAppFileRow[]> => {
    const result = await this.db
      .prepare(
        `
          SELECT item_id, path, content_type, sha256, size_bytes, storage_key, updated_at
          FROM marketplace_app_files
          WHERE item_id = ?
          ORDER BY path ASC
        `,
      )
      .bind(itemId)
      .all<MarketplaceAppFileRow>();
    return result.results ?? [];
  };

  getVersionRow = async (
    itemId: string,
    version: string,
  ): Promise<MarketplaceAppVersionRow | null> => {
    return (
      (await this.db
        .prepare(
          `
            SELECT
              item_id,
              version,
              manifest_json,
              permissions_json,
              description,
              bundle_sha256,
              bundle_storage_key,
              published_at,
              updated_at
            FROM marketplace_app_versions
            WHERE item_id = ? AND version = ?
            LIMIT 1
          `,
        )
        .bind(itemId, version)
        .first<MarketplaceAppVersionRow>()) ?? null
    );
  };
}
