import type {
  MarketplaceAppFileRow,
  MarketplaceAppItemRow,
  MarketplaceAppVersionRow,
} from "./app-marketplace.types";

const MARKETPLACE_APP_ITEM_COLUMNS = `
  id,
  slug,
  app_id,
  owner_scope,
  owner_user_id,
  owner_visibility,
  owner_deleted_at,
  app_name,
  publish_status,
  published_by_type,
  review_note,
  reviewed_at,
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
`;

export class MarketplaceAppRecordRepository {
  constructor(private readonly db: D1Database) {}

  getItemRow = async (selector: string): Promise<MarketplaceAppItemRow | null> => {
    return (
      (await this.db
        .prepare(
          `
            SELECT
              ${MARKETPLACE_APP_ITEM_COLUMNS}
            FROM marketplace_app_items
            WHERE slug = ? OR app_id = ?
            LIMIT 1
          `,
        )
        .bind(selector, selector)
        .first<MarketplaceAppItemRow>()) ?? null
    );
  };

  getPublishedPublicItemRow = async (selector: string): Promise<MarketplaceAppItemRow | null> => {
    return (
      (await this.db
        .prepare(
          `
            SELECT
              ${MARKETPLACE_APP_ITEM_COLUMNS}
            FROM marketplace_app_items
            WHERE (slug = ? OR app_id = ?)
              AND publish_status = 'published'
              AND COALESCE(owner_visibility, 'public') = 'public'
              AND owner_deleted_at IS NULL
            LIMIT 1
          `,
        )
        .bind(selector, selector)
        .first<MarketplaceAppItemRow>()) ?? null
    );
  };

  getPublishedPublicItemRowByAppId = async (appId: string): Promise<MarketplaceAppItemRow | null> => {
    return (
      (await this.db
        .prepare(
          `
            SELECT
              ${MARKETPLACE_APP_ITEM_COLUMNS}
            FROM marketplace_app_items
            WHERE app_id = ?
              AND publish_status = 'published'
              AND COALESCE(owner_visibility, 'public') = 'public'
              AND owner_deleted_at IS NULL
            LIMIT 1
          `,
        )
        .bind(appId)
        .first<MarketplaceAppItemRow>()) ?? null
    );
  };

  findExistingItemRowByAppId = async (appId: string): Promise<MarketplaceAppItemRow | null> => {
    return (
      (await this.db
        .prepare(
          `
            SELECT
              ${MARKETPLACE_APP_ITEM_COLUMNS}
            FROM marketplace_app_items
            WHERE app_id = ?
            LIMIT 1
          `,
        )
        .bind(appId)
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

  getFileRow = async (itemId: string, filePath: string): Promise<MarketplaceAppFileRow | null> => {
    return (
      (await this.db
        .prepare(
          `
            SELECT item_id, path, content_type, sha256, size_bytes, storage_key, updated_at
            FROM marketplace_app_files
            WHERE item_id = ? AND path = ?
            LIMIT 1
          `,
        )
        .bind(itemId, filePath)
        .first<MarketplaceAppFileRow>()) ?? null
    );
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

  listOwnerItemRows = async (params: {
    ownerUserId: string;
    q?: string;
  }): Promise<MarketplaceAppItemRow[]> => {
    const filters = ["owner_user_id = ?", "owner_deleted_at IS NULL"];
    const bindings: unknown[] = [params.ownerUserId];
    const normalizedQuery = params.q?.trim().toLowerCase();
    if (normalizedQuery) {
      const wildcard = `%${normalizedQuery}%`;
      filters.push(`(
        LOWER(name) LIKE ?
        OR LOWER(slug) LIKE ?
        OR LOWER(app_id) LIKE ?
        OR LOWER(summary) LIKE ?
        OR LOWER(tags) LIKE ?
      )`);
      bindings.push(wildcard, wildcard, wildcard, wildcard, wildcard);
    }
    const result = await this.db
      .prepare(
        `
          SELECT
            ${MARKETPLACE_APP_ITEM_COLUMNS}
          FROM marketplace_app_items
          WHERE ${filters.join(" AND ")}
          ORDER BY updated_at DESC, id DESC
        `,
      )
      .bind(...bindings)
      .all<MarketplaceAppItemRow>();
    return result.results ?? [];
  };

  getOwnerItemRow = async (params: {
    ownerUserId: string;
    selector: string;
    includeDeleted?: boolean;
  }): Promise<MarketplaceAppItemRow | null> => {
    const { includeDeleted, ownerUserId, selector } = params;
    const deletedClause = includeDeleted ? "" : " AND owner_deleted_at IS NULL";
    return (
      (await this.db
        .prepare(
          `
            SELECT
              ${MARKETPLACE_APP_ITEM_COLUMNS}
            FROM marketplace_app_items
            WHERE owner_user_id = ? AND (slug = ? OR app_id = ?)${deletedClause}
            LIMIT 1
          `,
        )
        .bind(ownerUserId, selector, selector)
        .first<MarketplaceAppItemRow>()) ?? null
    );
  };

  updateOwnerAppState = async (params: {
    itemId: string;
    action: "hide" | "show" | "delete";
    updatedAt: string;
  }): Promise<void> => {
    const { action, itemId, updatedAt } = params;
    if (action === "hide") {
      await this.db
        .prepare("UPDATE marketplace_app_items SET owner_visibility = 'hidden', updated_at = ? WHERE id = ?")
        .bind(updatedAt, itemId)
        .run();
      return;
    }
    if (action === "show") {
      await this.db
        .prepare("UPDATE marketplace_app_items SET owner_visibility = 'public', updated_at = ? WHERE id = ?")
        .bind(updatedAt, itemId)
        .run();
      return;
    }
    await this.db
      .prepare("UPDATE marketplace_app_items SET owner_deleted_at = ?, updated_at = ? WHERE id = ?")
      .bind(updatedAt, updatedAt, itemId)
      .run();
  };

  listPublishStatusCounts = async (): Promise<Array<{ publish_status: string | null; count: number | null }>> => {
    const result = await this.db
      .prepare(
        `
          SELECT publish_status, COUNT(1) AS count
          FROM marketplace_app_items
          WHERE owner_deleted_at IS NULL
          GROUP BY publish_status
        `,
      )
      .all<{ publish_status: string | null; count: number | null }>();
    return result.results ?? [];
  };

  countAdminItemRows = async (params: {
    publishStatus: string;
    q?: string;
  }): Promise<number> => {
    const { publishStatus, q } = params;
    const filters = ["owner_deleted_at IS NULL"];
    const bindings: unknown[] = [];
    if (publishStatus !== "all") {
      filters.push("publish_status = ?");
      bindings.push(publishStatus);
    }
    const normalizedQuery = q?.trim().toLowerCase();
    if (normalizedQuery) {
      const wildcard = `%${normalizedQuery}%`;
      filters.push(`(
        LOWER(name) LIKE ?
        OR LOWER(slug) LIKE ?
        OR LOWER(app_id) LIKE ?
        OR LOWER(summary) LIKE ?
        OR LOWER(author) LIKE ?
        OR LOWER(tags) LIKE ?
      )`);
      bindings.push(wildcard, wildcard, wildcard, wildcard, wildcard, wildcard);
    }
    const whereClause = `WHERE ${filters.join(" AND ")}`;
    const row = await this.db
      .prepare(`SELECT COUNT(1) AS count FROM marketplace_app_items ${whereClause}`)
      .bind(...bindings)
      .first<{ count: number | null }>();
    return Number.isFinite(row?.count) ? Number(row?.count) : 0;
  };

  listAdminItemRows = async (params: {
    publishStatus: string;
    q?: string;
    page: number;
    pageSize: number;
  }): Promise<MarketplaceAppItemRow[]> => {
    const { page, pageSize, publishStatus, q } = params;
    const filters = ["owner_deleted_at IS NULL"];
    const bindings: unknown[] = [];
    if (publishStatus !== "all") {
      filters.push("publish_status = ?");
      bindings.push(publishStatus);
    }
    const normalizedQuery = q?.trim().toLowerCase();
    if (normalizedQuery) {
      const wildcard = `%${normalizedQuery}%`;
      filters.push(`(
        LOWER(name) LIKE ?
        OR LOWER(slug) LIKE ?
        OR LOWER(app_id) LIKE ?
        OR LOWER(summary) LIKE ?
        OR LOWER(author) LIKE ?
        OR LOWER(tags) LIKE ?
      )`);
      bindings.push(wildcard, wildcard, wildcard, wildcard, wildcard, wildcard);
    }
    const offset = (page - 1) * pageSize;
    const result = await this.db
      .prepare(
        `
          SELECT
            ${MARKETPLACE_APP_ITEM_COLUMNS}
          FROM marketplace_app_items
          WHERE ${filters.join(" AND ")}
          ORDER BY updated_at DESC, id DESC
          LIMIT ? OFFSET ?
        `,
      )
      .bind(...bindings, pageSize, offset)
      .all<MarketplaceAppItemRow>();
    return result.results ?? [];
  };

  updateReviewStatus = async (params: {
    itemId: string;
    publishStatus: string;
    reviewNote: string | null;
    updatedAt: string;
  }): Promise<void> => {
    const { itemId, publishStatus, reviewNote, updatedAt } = params;
    await this.db
      .prepare(
        `
          UPDATE marketplace_app_items
          SET publish_status = ?, review_note = ?, reviewed_at = ?, updated_at = ?
          WHERE id = ?
        `,
      )
      .bind(publishStatus, reviewNote, updatedAt, updatedAt, itemId)
      .run();
  };
}
