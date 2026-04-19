import { DomainValidationError, ResourceNotFoundError } from "../../domain/errors";
import type { MarketplaceListQuery } from "../../domain/model";
import {
  type MarketplaceAppFileInput,
  type MarketplaceAppFileRow,
  type MarketplaceAppFilesResult,
  type MarketplaceAppItemDetail,
  type MarketplaceAppItemRow,
  type MarketplaceAppItemSummary,
  type MarketplaceAppListResult,
  type MarketplaceAppPublishResult,
  type MarketplaceAppVersionRow,
  OFFICIAL_APPS_WEB_BASE_URL,
} from "./app-marketplace.types";
import { MarketplaceAppFileStore } from "./marketplace-app-file.store";
import { MarketplaceAppPayloadParser } from "./marketplace-app-payload.service";
import { MarketplaceAppPersistence } from "./marketplace-app-persistence.service";
import { MarketplaceAppQuerySupport } from "./marketplace-app-query.service";
import { MarketplaceAppRecordMapper } from "./marketplace-app-record.service";
import { MarketplaceAppRecordRepository } from "./marketplace-app-record.repository";

export class D1MarketplaceAppDataSource {
  private readonly fileStore: MarketplaceAppFileStore;
  private readonly payloadParser = new MarketplaceAppPayloadParser();
  private readonly persistence: MarketplaceAppPersistence;
  private readonly querySupport = new MarketplaceAppQuerySupport();
  private readonly recordMapper = new MarketplaceAppRecordMapper();
  private readonly recordRepository: MarketplaceAppRecordRepository;

  constructor(
    private readonly db: D1Database,
    filesBucket: R2Bucket,
  ) {
    this.fileStore = new MarketplaceAppFileStore(filesBucket);
    this.persistence = new MarketplaceAppPersistence(db);
    this.recordRepository = new MarketplaceAppRecordRepository(db);
  }

  listApps = async (query: MarketplaceListQuery): Promise<MarketplaceAppListResult> => {
    const filters = this.querySupport.buildFilters(query);
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
    const itemRow = await this.recordRepository.getItemRow(selector);
    if (!itemRow) {
      return null;
    }
    const versionRows = await this.recordRepository.listVersionRows(itemRow.id);
    return this.recordMapper.mapItemDetail(itemRow, versionRows);
  };

  getAppFiles = async (selector: string): Promise<MarketplaceAppFilesResult | null> => {
    const itemRow = await this.recordRepository.getItemRow(selector);
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
    const itemRow = await this.recordRepository.getItemRow(selector);
    if (!itemRow) {
      return null;
    }
    const fileRow = await this.db
      .prepare(
        `
          SELECT item_id, path, content_type, sha256, size_bytes, storage_key, updated_at
          FROM marketplace_app_files
          WHERE item_id = ? AND path = ?
          LIMIT 1
        `,
      )
      .bind(itemRow.id, filePath)
      .first<MarketplaceAppFileRow>();
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
    const itemRow = await this.recordRepository.getItemRow(selector);
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
    const itemRow = await this.db
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
          WHERE app_id = ?
          LIMIT 1
        `,
      )
      .bind(appId)
      .first<MarketplaceAppItemRow>();
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
              bundle: `/api/v1/apps/items/${encodeURIComponent(itemRow.slug)}/bundles/${encodeURIComponent(row.version)}`,
              sha256: row.bundle_sha256,
            },
          },
        ]),
      ),
    };
  };

  publishApp = async (rawInput: unknown): Promise<MarketplaceAppPublishResult> => {
    const input = this.payloadParser.parsePublishInput(rawInput);
    const existingItem = await this.db
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
          WHERE app_id = ?
          LIMIT 1
        `,
      )
      .bind(input.appId)
      .first<MarketplaceAppItemRow>();
    const nowIso = new Date().toISOString();
    const itemId = existingItem?.id ?? `app-${input.slug}`;
    const publishedAt = existingItem?.published_at ?? nowIso;
    const existingVersion = await this.recordRepository.getVersionRow(itemId, input.version);
    const versionPublishedAt = existingVersion?.published_at ?? nowIso;
    const bundleBytes = this.payloadParser.decodeBase64(input.bundleBase64, "bundleBase64");
    const bundleObject = await this.fileStore.putBundle({
      appId: input.appId,
      version: input.version,
      bytes: bundleBytes,
    });
    if (bundleObject.sha256 !== input.bundleSha256) {
      throw new DomainValidationError(
        `bundleSha256 mismatch: expected ${input.bundleSha256}, actual ${bundleObject.sha256}`,
      );
    }
    await this.persistence.persistVersion({
      itemId,
      input,
      bundleStorageKey: bundleObject.storageKey,
      publishedAt: versionPublishedAt,
      updatedAt: nowIso,
    });
    await this.replaceFiles(itemId, input.appId, input.files, nowIso);

    const latestVersion = this.querySupport.pickLatestVersion(existingItem?.latest_version, input.version);
    await this.persistence.persistItem({
      itemId,
      input,
      latestVersion,
      publishedAt,
      updatedAt: nowIso,
    });
    const item = {
      slug: input.slug,
      appId: input.appId,
      name: input.name,
      latestVersion,
      webUrl: `${OFFICIAL_APPS_WEB_BASE_URL}/apps/${input.slug}`,
      install: this.recordMapper.buildInstallSpec(input.appId),
    };
    return {
      created: !existingItem,
      item,
      fileCount: input.files.length,
    };
  };

  private replaceFiles = async (
    itemId: string,
    appId: string,
    files: MarketplaceAppFileInput[],
    updatedAt: string,
  ): Promise<void> => {
    const existingFiles = await this.recordRepository.listFileRows(itemId);
    await this.fileStore.deleteObjects(existingFiles.map((row) => row.storage_key));
    await this.db
      .prepare("DELETE FROM marketplace_app_files WHERE item_id = ?")
      .bind(itemId)
      .run();

    for (const file of files) {
      const bytes = this.payloadParser.decodeBase64(file.contentBase64, `files.${file.path}`);
      const contentType = this.querySupport.resolveContentType(file.path);
      const stored = await this.fileStore.putFile({
        appId,
        filePath: file.path,
        bytes,
        contentType,
      });
      await this.db
        .prepare(
          `
            INSERT INTO marketplace_app_files (
              item_id,
              path,
              content_type,
              sha256,
              size_bytes,
              storage_key,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
        )
        .bind(
          itemId,
          file.path,
          contentType,
          stored.sha256,
          stored.sizeBytes,
          stored.storageKey,
          updatedAt,
        )
        .run();
    }
  };



}
