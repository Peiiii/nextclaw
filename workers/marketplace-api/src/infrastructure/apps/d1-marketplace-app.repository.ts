import { DomainValidationError, ResourceNotFoundError } from "../../domain/errors";
import type { MarketplaceListQuery } from "../../domain/model";
import {
  type MarketplaceAppFileInput,
  type MarketplaceAppFileRow,
  type MarketplaceAdminAppDetailPayload,
  type MarketplaceAdminAppListResult,
  type MarketplaceAdminAppPublishStatus,
  type MarketplaceAppFilesResult,
  type MarketplaceAppItemDetail,
  type MarketplaceAppItemRow,
  type MarketplaceAppItemSummary,
  type MarketplaceAppListResult,
  type MarketplaceAppPublishResult,
  type MarketplaceAppVersionRow,
  type MarketplaceOwnerAppDetail,
  type MarketplaceOwnerAppListResult,
  type MarketplaceOwnerAppManageAction,
} from "./app-marketplace.types";
import { MarketplaceAppFileStore } from "./marketplace-app-file.store";
import { MarketplaceAppPayloadParser } from "./marketplace-app-payload.service";
import { MarketplaceAppPersistence } from "./marketplace-app-persistence.service";
import {
  assertExistingAppOwnership,
  buildAppWebUrl,
  parseAppReviewInput,
  resolveAppIdentity,
  type ExistingAppRow,
} from "./marketplace-app-publish.service";
import { MarketplaceAppPublicReader } from "./marketplace-app-public-reader.service";
import { MarketplaceAppQuerySupport } from "./marketplace-app-query.service";
import { MarketplaceAppRecordMapper } from "./marketplace-app-record.service";
import { MarketplaceAppRecordRepository } from "./marketplace-app-record.repository";
import type { MarketplaceSkillPublishActor } from "../d1-data-source";

export class D1MarketplaceAppDataSource {
  private readonly fileStore: MarketplaceAppFileStore;
  private readonly payloadParser = new MarketplaceAppPayloadParser();
  private readonly persistence: MarketplaceAppPersistence;
  private readonly querySupport = new MarketplaceAppQuerySupport();
  private readonly recordMapper = new MarketplaceAppRecordMapper();
  private readonly recordRepository: MarketplaceAppRecordRepository;
  private readonly publicReader: MarketplaceAppPublicReader;

  constructor(
    private readonly db: D1Database,
    filesBucket: R2Bucket,
  ) {
    this.fileStore = new MarketplaceAppFileStore(filesBucket);
    this.persistence = new MarketplaceAppPersistence(db);
    this.recordRepository = new MarketplaceAppRecordRepository(db);
    this.publicReader = new MarketplaceAppPublicReader(
      db,
      this.fileStore,
      this.querySupport,
      this.recordMapper,
      this.recordRepository,
    );
  }

  listApps = async (query: MarketplaceListQuery): Promise<MarketplaceAppListResult> => {
    return this.publicReader.listApps(query);
  };

  getAppDetail = async (selector: string): Promise<MarketplaceAppItemDetail | null> => {
    return this.publicReader.getAppDetail(selector);
  };

  getAppFiles = async (selector: string): Promise<MarketplaceAppFilesResult | null> => {
    return this.publicReader.getAppFiles(selector);
  };

  getAppFileContent = async (
    selector: string,
    filePath: string,
  ): Promise<{ item: MarketplaceAppItemSummary; file: MarketplaceAppFileRow; object: R2ObjectBody } | null> => {
    return this.publicReader.getAppFileContent(selector, filePath);
  };

  getBundle = async (
    selector: string,
    version: string,
  ): Promise<{ item: MarketplaceAppItemSummary; version: MarketplaceAppVersionRow; object: R2ObjectBody } | null> => {
    return this.publicReader.getBundle(selector, version);
  };

  getRegistryDocument = async (appId: string): Promise<Record<string, unknown> | null> => {
    return this.publicReader.getRegistryDocument(appId);
  };

  publishApp = async (rawInput: unknown, actor: MarketplaceSkillPublishActor): Promise<MarketplaceAppPublishResult> => {
    const input = this.payloadParser.parsePublishInput(rawInput);
    const identity = resolveAppIdentity(input, actor);
    const existingItem = (await this.recordRepository.findExistingItemRowByAppId(input.appId)) as
      | (ExistingAppRow & MarketplaceAppItemRow)
      | null;
    if (input.requireExisting && !existingItem) {
      throw new DomainValidationError(`app does not exist yet: ${input.appId}`);
    }
    if (existingItem) {
      assertExistingAppOwnership(existingItem, identity, actor);
    }
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
      ownerScope: identity.ownerScope,
      ownerUserId: identity.ownerUserId,
      appName: identity.appName,
      publishStatus: identity.ownerScope === "nextclaw" ? "published" : "pending",
      publishedByType: identity.ownerScope === "nextclaw" ? "admin" : "user",
      latestVersion,
      publishedAt,
      updatedAt: nowIso,
    });
    const publishStatus: MarketplaceAppPublishResult["item"]["publishStatus"] =
      identity.ownerScope === "nextclaw" ? "published" : "pending";
    return {
      created: !existingItem,
      item: {
        slug: identity.slug,
        appId: input.appId,
        ownerScope: identity.ownerScope,
        appName: identity.appName,
        publishStatus,
        name: input.name,
        latestVersion,
        webUrl: buildAppWebUrl(identity.slug),
        install: this.recordMapper.buildInstallSpec(input.appId),
      },
      fileCount: input.files.length,
    };
  };

  listOwnerApps = async (params: { ownerUserId: string; q?: string }): Promise<MarketplaceOwnerAppListResult> => {
    const rows = await this.recordRepository.listOwnerItemRows(params);
    const items = rows.map((row) => this.recordMapper.mapOwnerSummary(row));
    return {
      total: items.length,
      items,
    };
  };

  getOwnerAppDetail = async (selector: string, ownerUserId: string): Promise<MarketplaceOwnerAppDetail | null> => {
    const itemRow = await this.recordRepository.getOwnerItemRow({
      ownerUserId,
      selector,
    });
    if (!itemRow) {
      return null;
    }
    const versionRows = await this.recordRepository.listVersionRows(itemRow.id);
    return this.recordMapper.mapOwnerDetail(itemRow, versionRows);
  };

  manageOwnerApp = async (params: {
    selector: string;
    ownerUserId: string;
    action: MarketplaceOwnerAppManageAction;
  }): Promise<MarketplaceOwnerAppDetail> => {
    const { action, ownerUserId, selector } = params;
    const itemRow = await this.recordRepository.getOwnerItemRow({
      ownerUserId,
      selector,
      includeDeleted: true,
    });
    if (!itemRow) {
      throw new DomainValidationError(`app item not found: ${selector}`);
    }
    const updatedAt = new Date().toISOString();
    await this.recordRepository.updateOwnerAppState({
      itemId: itemRow.id,
      action,
      updatedAt,
    });
    const nextRow = await this.recordRepository.getItemRow(itemRow.id);
    if (!nextRow) {
      throw new DomainValidationError(`app action succeeded but item not found: ${selector}`);
    }
    const versionRows = await this.recordRepository.listVersionRows(nextRow.id);
    return this.recordMapper.mapOwnerDetail(nextRow, versionRows);
  };

  listAdminApps = async (params: {
    publishStatus: MarketplaceAdminAppPublishStatus;
    q?: string;
    page: number;
    pageSize: number;
  }): Promise<MarketplaceAdminAppListResult> => {
    const { page, pageSize, publishStatus, q } = params;
    const counts = { pending: 0, published: 0, rejected: 0 };
    for (const row of await this.recordRepository.listPublishStatusCounts()) {
      const status = this.recordMapper.readPublishStatus(row.publish_status);
      counts[status] = Number.isFinite(row.count) ? Number(row.count) : 0;
    }
    const total = await this.recordRepository.countAdminItemRows(params);
    const rows = await this.recordRepository.listAdminItemRows(params);
    return {
      counts,
      total,
      page,
      pageSize,
      totalPages: total > 0 ? Math.ceil(total / pageSize) : 0,
      publishStatus,
      query: q?.trim().toLowerCase() || undefined,
      items: rows.map((row) => this.recordMapper.mapAdminSummary(row)),
    };
  };

  getAdminAppDetail = async (selector: string): Promise<MarketplaceAdminAppDetailPayload | null> => {
    const itemRow = await this.recordRepository.getItemRow(selector);
    if (!itemRow) {
      return null;
    }
    const versionRows = await this.recordRepository.listVersionRows(itemRow.id);
    const files = await this.recordRepository.listFileRows(itemRow.id);
    const readmePayload = await this.getAnyAppFileContent(itemRow.id, itemRow.slug, "README.md");
    const metadataPayload = await this.getAnyAppFileContent(itemRow.id, itemRow.slug, "marketplace.json");
    return {
      item: this.recordMapper.mapAdminDetail(itemRow, versionRows),
      files: files.map((row) => ({
        path: row.path,
        contentType: row.content_type,
        sizeBytes: row.size_bytes,
        sha256: row.sha256,
        updatedAt: row.updated_at,
        downloadPath: `/api/v1/apps/items/${encodeURIComponent(itemRow.slug)}/files/blob?path=${encodeURIComponent(row.path)}`,
      })),
      readmeRaw: readmePayload ? new TextDecoder().decode(await readmePayload.object.arrayBuffer()) : undefined,
      marketplaceJsonRaw: metadataPayload ? new TextDecoder().decode(await metadataPayload.object.arrayBuffer()) : undefined,
    };
  };

  reviewApp = async (rawInput: unknown) => {
    const input = parseAppReviewInput(rawInput);
    const itemRow = await this.recordRepository.getItemRow(input.selector);
    if (!itemRow) {
      throw new DomainValidationError(`app item not found: ${input.selector}`);
    }
    const updatedAt = new Date().toISOString();
    await this.recordRepository.updateReviewStatus({
      itemId: itemRow.id,
      publishStatus: input.publishStatus,
      reviewNote: input.reviewNote ?? null,
      updatedAt,
    });
    const next = await this.getAdminAppDetail(itemRow.slug);
    if (!next) {
      throw new DomainValidationError(`review succeeded but item not found: ${itemRow.slug}`);
    }
    return next.item;
  };

  private getAnyAppFileContent = async (
    itemId: string,
    selector: string,
    filePath: string,
  ): Promise<{ file: MarketplaceAppFileRow; object: R2ObjectBody } | null> => {
    const fileRow = await this.recordRepository.getFileRow(itemId, filePath);
    if (!fileRow) {
      return null;
    }
    const object = await this.fileStore.getObject(fileRow.storage_key);
    if (!object) {
      throw new ResourceNotFoundError(`app file object missing: ${selector}/${filePath}`);
    }
    return {
      file: fileRow,
      object,
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
