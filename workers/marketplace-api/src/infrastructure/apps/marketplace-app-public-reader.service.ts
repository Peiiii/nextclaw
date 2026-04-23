import { ResourceNotFoundError } from "../../domain/errors";
import type { MarketplaceListQuery } from "../../domain/model";
import type {
  MarketplaceAppFileRow,
  MarketplaceAppFilesResult,
  MarketplaceAppItemDetail,
  MarketplaceAppItemRow,
  MarketplaceAppItemSummary,
  MarketplaceAppListResult,
  MarketplaceAppVersionRow,
} from "./app-marketplace.types";
import type { MarketplaceAppFileStore } from "./marketplace-app-file.store";
import type { MarketplaceAppQuerySupport } from "./marketplace-app-query.service";
import type { MarketplaceAppRecordMapper } from "./marketplace-app-record.service";
import type { MarketplaceAppRecordRepository } from "./marketplace-app-record.repository";

export class MarketplaceAppPublicReader {
  constructor(
    private readonly db: D1Database,
    private readonly fileStore: MarketplaceAppFileStore,
    private readonly querySupport: MarketplaceAppQuerySupport,
    private readonly recordMapper: MarketplaceAppRecordMapper,
    private readonly recordRepository: MarketplaceAppRecordRepository,
  ) {}

  listApps = async (query: MarketplaceListQuery): Promise<MarketplaceAppListResult> => {
    const filters = this.querySupport.buildPublicFilters(query);
    const totalRow = await this.db
      .prepare(
        `
          SELECT COUNT(*) AS total
          FROM marketplace_app_items
          ${filters.whereClause}
        `,
      )
      .bind(...filters.bindings)
      .first<{ total: number }>();
    const total = Number(totalRow?.total ?? 0);
    const offset = (query.page - 1) * query.pageSize;
    const rows = await this.db
      .prepare(
        `
          SELECT
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
          FROM marketplace_app_items
          ${filters.whereClause}
          ORDER BY featured DESC, updated_at DESC, slug ASC
          LIMIT ? OFFSET ?
        `,
      )
      .bind(...filters.bindings, query.pageSize, offset)
      .all<MarketplaceAppItemRow>();

    return {
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
      query: query.q,
      tag: query.tag,
      items: (rows.results ?? []).map((row) => this.recordMapper.mapItemSummary(row)),
    };
  };

  getAppDetail = async (selector: string): Promise<MarketplaceAppItemDetail | null> => {
    const itemRow = await this.recordRepository.getPublishedPublicItemRow(selector);
    if (!itemRow) {
      return null;
    }
    const versionRows = await this.recordRepository.listVersionRows(itemRow.id);
    return this.recordMapper.mapItemDetail(itemRow, versionRows);
  };

  getAppFiles = async (selector: string): Promise<MarketplaceAppFilesResult | null> => {
    const itemRow = await this.recordRepository.getPublishedPublicItemRow(selector);
    if (!itemRow) {
      return null;
    }
    const fileRows = await this.recordRepository.listFileRows(itemRow.id);
    return {
      slug: itemRow.slug,
      appId: itemRow.app_id,
      totalFiles: fileRows.length,
      files: fileRows.map((row) => ({
        path: row.path,
        contentType: row.content_type,
        sizeBytes: row.size_bytes,
        sha256: row.sha256,
        updatedAt: row.updated_at,
        downloadPath: `/api/v1/apps/items/${encodeURIComponent(itemRow.slug)}/files/blob?path=${encodeURIComponent(row.path)}`,
      })),
    };
  };

  getAppFileContent = async (
    selector: string,
    filePath: string,
  ): Promise<{ item: MarketplaceAppItemSummary; file: MarketplaceAppFileRow; object: R2ObjectBody } | null> => {
    const itemRow = await this.recordRepository.getPublishedPublicItemRow(selector);
    if (!itemRow) {
      return null;
    }
    const fileRow = await this.recordRepository.getFileRow(itemRow.id, filePath);
    if (!fileRow) {
      return null;
    }
    const object = await this.fileStore.getObject(fileRow.storage_key);
    if (!object) {
      throw new ResourceNotFoundError(`app file object missing: ${selector}/${filePath}`);
    }
    return {
      item: this.recordMapper.mapItemSummary(itemRow),
      file: fileRow,
      object,
    };
  };

  getBundle = async (
    selector: string,
    version: string,
  ): Promise<{ item: MarketplaceAppItemSummary; version: MarketplaceAppVersionRow; object: R2ObjectBody } | null> => {
    const itemRow = await this.recordRepository.getPublishedPublicItemRow(selector);
    if (!itemRow) {
      return null;
    }
    const versionRow = await this.recordRepository.getVersionRow(itemRow.id, version);
    if (!versionRow) {
      return null;
    }
    const object = await this.fileStore.getObject(versionRow.bundle_storage_key);
    if (!object) {
      throw new ResourceNotFoundError(`app bundle object missing: ${selector}@${version}`);
    }
    return {
      item: this.recordMapper.mapItemSummary(itemRow),
      version: versionRow,
      object,
    };
  };

  getRegistryDocument = async (appId: string): Promise<Record<string, unknown> | null> => {
    const itemRow = await this.recordRepository.getPublishedPublicItemRowByAppId(appId);
    if (!itemRow) {
      return null;
    }
    const versionRows = await this.recordRepository.listVersionRows(itemRow.id);
    return {
      name: itemRow.app_id,
      description: itemRow.description ?? undefined,
      "dist-tags": {
        latest: itemRow.latest_version,
      },
      versions: Object.fromEntries(
        versionRows.map((row) => [
          row.version,
          {
            name: itemRow.app_id,
            version: row.version,
            description: row.description ?? itemRow.description ?? undefined,
            publisher: this.recordMapper.readPublisher(itemRow),
            permissions: this.recordMapper.parsePermissions(row.permissions_json, `${itemRow.slug}.permissions_json`),
            dist: {
              kind: row.distribution_mode,
              bundle: `/api/v1/apps/items/${encodeURIComponent(itemRow.slug)}/bundles/${encodeURIComponent(row.version)}`,
              sha256: row.bundle_sha256,
            },
          },
        ]),
      ),
    };
  };
}
