import { DomainValidationError, ResourceNotFoundError } from "@/domain/errors";
import type { MarketplaceAppCatalogQuery, MarketplaceListQuery } from "@/domain/model";
import {
  type MarketplaceAppCatalogResult,
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
  resolveCatalogVisibility,
  resolveAppIdentity,
  type ExistingAppRow,
} from "./marketplace-app-publish.utils";
import { MarketplaceAppPublicReader } from "./marketplace-app-public-reader.service";
import { MarketplaceAppQuerySupport } from "./marketplace-app-query.service";
import { MarketplaceAppRecordMapper } from "./marketplace-app-record.service";
import { MarketplaceAppRecordRepository } from "./marketplace-app-record.repository";
import type { MarketplaceSkillPublishActor } from "@/infrastructure/skills/d1-section-types";

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

  listCatalog = async (query: MarketplaceAppCatalogQuery): Promise<MarketplaceAppCatalogResult> => {
    return this.publicReader.listCatalog(query);
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
    sha256?: string,
  ): Promise<{ item: MarketplaceAppItemSummary; file: MarketplaceAppFileRow; object: R2ObjectBody } | null> => {
    return this.publicReader.getAppFileContent(selector, filePath, sha256);
  };

  getBundle = async (
    selector: string,
    version: string,
    range?: string,
  ): Promise<{ item: MarketplaceAppItemSummary; version: MarketplaceAppVersionRow; object: R2ObjectBody } | null> => {
    return this.publicReader.getBundle(selector, version, range);
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
    if (existingVersion && existingVersion.bundle_sha256 !== input.bundleSha256) {
      throw new DomainValidationError(
        `app version is immutable: ${input.appId}@${input.version} already has a different bundle`,
      );
    }
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
    const storedFiles = await this.replaceFiles(itemId, input.appId, input.files, nowIso);

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
      manifestSchemaVersion: input.manifest.schemaVersion,
      catalogVisibility: input.manifest.schemaVersion >= 2
        ? resolveCatalogVisibility({
            existing: existingItem?.catalog_visibility,
            isNew: !existingItem,
            ownerScope: identity.ownerScope,
          })
        : "unlisted",
      iconSha256: input.manifest.icon
        ? storedFiles.get(input.manifest.icon)?.sha256 ?? null
        : null,
      coverSha256: input.visuals?.cover
        ? storedFiles.get(input.visuals.cover)?.sha256 ?? null
        : null,
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
    if (input.catalogVisibility === "listed" && itemRow.manifest_schema_version < 2) {
      throw new DomainValidationError("legacy schema v1 apps cannot be listed in the product catalog");
    }
    const catalogVisibility = input.catalogVisibility ?? (
      input.publishStatus === "published"
        ? itemRow.manifest_schema_version === 2 ? "listed" : "unlisted"
        : undefined
    );
    const updatedAt = new Date().toISOString();
    await this.recordRepository.updateReviewStatus({
      itemId: itemRow.id,
      publishStatus: input.publishStatus,
      catalogVisibility,
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
  ): Promise<Map<string, { sha256: string; storageKey: string }>> => {
    const existingFiles = await this.recordRepository.listFileRows(itemId);
    await Promise.all(existingFiles.map(async (file) => await this.fileStore.preserveFileRevision({
      appId,
      filePath: file.path,
      storageKey: file.storage_key,
      sha256: file.sha256,
      contentType: file.content_type,
    })));
    await this.db
      .prepare("DELETE FROM marketplace_app_files WHERE item_id = ?")
      .bind(itemId)
      .run();

    const storedFiles = new Map<string, { sha256: string; storageKey: string }>();
    for (const file of files) {
      const bytes = this.payloadParser.decodeBase64(file.contentBase64, `files.${file.path}`);
      const contentType = this.querySupport.resolveContentType(file.path);
      const stored = await this.fileStore.putFile({
        appId,
        filePath: file.path,
        bytes,
        contentType,
      });
      storedFiles.set(file.path, {
        sha256: stored.sha256,
        storageKey: stored.storageKey,
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
    return storedFiles;
  };
}
