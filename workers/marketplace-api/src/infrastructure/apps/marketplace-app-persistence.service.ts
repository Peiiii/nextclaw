import type { MarketplaceAppPublishInput } from "./app-marketplace.types";
import type { AppArtifactTarget } from "@nextclaw/app-runtime";

export class MarketplaceAppPersistence {
  constructor(private readonly db: D1Database) {}

  persistVersion = async (params: {
    itemId: string;
    input: MarketplaceAppPublishInput;
    bundleStorageKey: string;
    bundleSha256: string;
    artifacts: Array<{
      target: AppArtifactTarget;
      targetKey: string;
      sha256: string;
      sizeBytes: number;
      storageKey: string;
    }>;
    publishedAt: string;
    updatedAt: string;
  }): Promise<void> => {
    const { artifacts, itemId, input, bundleSha256, bundleStorageKey, publishedAt, updatedAt } = params;
    const versionStatement = this.db.prepare(
        `
          INSERT INTO marketplace_app_versions (
            item_id,
            version,
            manifest_json,
            permissions_json,
            description,
            distribution_mode,
            bundle_sha256,
            bundle_storage_key,
            published_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(item_id, version) DO UPDATE SET
            manifest_json = excluded.manifest_json,
            permissions_json = excluded.permissions_json,
            description = excluded.description,
            distribution_mode = excluded.distribution_mode,
            bundle_sha256 = excluded.bundle_sha256,
            bundle_storage_key = excluded.bundle_storage_key,
            updated_at = excluded.updated_at
        `,
      ).bind(
        itemId,
        input.version,
        JSON.stringify(input.manifest),
        JSON.stringify(input.permissions ?? {}),
        input.description ?? null,
        input.distributionMode,
        bundleSha256,
        bundleStorageKey,
        publishedAt,
        updatedAt,
      );
    const statements = [
      versionStatement,
      this.db.prepare(
        "DELETE FROM marketplace_app_artifacts WHERE item_id = ? AND version = ?",
      ).bind(itemId, input.version),
      ...artifacts.map((artifact) => this.db.prepare(
        `
          INSERT INTO marketplace_app_artifacts (
            item_id,
            version,
            target_key,
            target_json,
            bundle_sha256,
            size_bytes,
            bundle_storage_key,
            status,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
        `,
      ).bind(
        itemId,
        input.version,
        artifact.targetKey,
        JSON.stringify(artifact.target),
        artifact.sha256,
        artifact.sizeBytes,
        artifact.storageKey,
        publishedAt,
        updatedAt,
      )),
    ];
    await this.db.batch(statements);
  };

  persistItem = async (params: {
    itemId: string;
    input: MarketplaceAppPublishInput;
    ownerScope: string;
    ownerUserId: string | null;
    appName: string;
    publishStatus: "pending" | "published";
    publishedByType: "admin" | "user";
    latestVersion: string;
    manifestSchemaVersion: 1 | 2;
    catalogVisibility: "listed" | "unlisted";
    iconSha256: string | null;
    coverSha256: string | null;
    publishedAt: string;
    updatedAt: string;
  }): Promise<void> => {
    const {
      itemId,
      input,
      ownerScope,
      ownerUserId,
      appName,
      publishStatus,
      publishedByType,
      latestVersion,
      manifestSchemaVersion,
      catalogVisibility,
      iconSha256,
      coverSha256,
      publishedAt,
      updatedAt,
    } = params;
    await this.db
      .prepare(
        `
          INSERT INTO marketplace_app_items (
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
            cover_path,
            accent_color,
            icon_sha256,
            cover_sha256,
            latest_version,
            manifest_schema_version,
            catalog_visibility,
            manifest_json,
            permissions_json,
            published_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(app_id) DO UPDATE SET
            slug = excluded.slug,
            owner_scope = excluded.owner_scope,
            owner_user_id = excluded.owner_user_id,
            owner_visibility = excluded.owner_visibility,
            owner_deleted_at = excluded.owner_deleted_at,
            app_name = excluded.app_name,
            publish_status = excluded.publish_status,
            published_by_type = excluded.published_by_type,
            review_note = excluded.review_note,
            reviewed_at = excluded.reviewed_at,
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
            cover_path = excluded.cover_path,
            accent_color = excluded.accent_color,
            icon_sha256 = excluded.icon_sha256,
            cover_sha256 = excluded.cover_sha256,
            latest_version = excluded.latest_version,
            manifest_schema_version = excluded.manifest_schema_version,
            catalog_visibility = excluded.catalog_visibility,
            manifest_json = excluded.manifest_json,
            permissions_json = excluded.permissions_json,
            updated_at = excluded.updated_at
        `,
      )
      .bind(
        itemId,
        input.slug,
        input.appId,
        ownerScope,
        ownerUserId,
        "public",
        null,
        appName,
        publishStatus,
        publishedByType,
        null,
        null,
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
        input.visuals?.cover ?? null,
        input.visuals?.accentColor ?? null,
        iconSha256,
        coverSha256,
        latestVersion,
        manifestSchemaVersion,
        catalogVisibility,
        JSON.stringify(input.manifest),
        JSON.stringify(input.permissions ?? {}),
        publishedAt,
        updatedAt,
      )
      .run();
  };
}
