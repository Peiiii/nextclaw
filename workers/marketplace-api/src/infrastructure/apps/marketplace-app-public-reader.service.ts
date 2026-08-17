import { ResourceNotFoundError } from "@/domain/errors";
import type {
  MarketplaceAppCatalogQuery,
  MarketplaceAppCatalogSort,
  MarketplaceListQuery,
} from "@/domain/model";
import type {
  MarketplaceAppArtifactRow,
  MarketplaceAppCatalogResult,
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
import type { MarketplaceAppArtifactRepository } from "./artifacts/marketplace-app-artifact.repository";

type MarketplaceAppCatalogRow = MarketplaceAppItemRow & {
  relevance?: number;
};
type MarketplaceAppCatalogCursor = ReturnType<
  MarketplaceAppQuerySupport["decodeCatalogCursor"]
>;
type MarketplaceAppCatalogStatement = {
  sql: string;
  bindings: unknown[];
  sort: MarketplaceAppCatalogSort;
};

export class MarketplaceAppPublicReader {
  constructor(
    private readonly db: D1Database,
    private readonly fileStore: MarketplaceAppFileStore,
    private readonly querySupport: MarketplaceAppQuerySupport,
    private readonly recordMapper: MarketplaceAppRecordMapper,
    private readonly recordRepository: MarketplaceAppRecordRepository,
    private readonly artifactRepository: MarketplaceAppArtifactRepository,
  ) {}

  listCatalog = async (query: MarketplaceAppCatalogQuery): Promise<MarketplaceAppCatalogResult> => {
    const session = this.db.withSession("first-unconstrained");
    const cursor = this.querySupport.decodeCatalogCursor(query.cursor, query);
    const { bindings, sort, sql } = this.buildCatalogStatement(query, cursor);
    const result = await session.prepare(sql).bind(...bindings).all<MarketplaceAppCatalogRow>();
    const rows = result.results ?? [];
    const hasMore = rows.length > query.limit;
    const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
    const lastRow = pageRows.at(-1);
    return {
      items: pageRows.map((row) => this.recordMapper.mapItemSummary(row)),
      hasMore,
      nextCursor: hasMore && lastRow
        ? this.querySupport.encodeCatalogCursor(query, lastRow)
        : undefined,
      query: query.q,
      tag: query.tag,
      tags: query.tags,
      publisher: query.publisher,
      featured: query.featured,
      sort,
    };
  };

  private buildCatalogStatement = (
    query: MarketplaceAppCatalogQuery,
    cursor: MarketplaceAppCatalogCursor,
  ): MarketplaceAppCatalogStatement => {
    const sort = this.querySupport.resolveCatalogSort(query);
    const filters = this.buildCatalogFilters(query);
    return sort === "relevance"
      ? this.buildRelevanceCatalogStatement(query, cursor, filters)
      : this.buildOrderedCatalogStatement(query, cursor, sort, filters);
  };

  private buildCatalogFilters = (query: MarketplaceAppCatalogQuery): {
    bindings: unknown[];
    filters: string[];
    fromClause: string;
  } => {
    const filters = this.querySupport.buildProductCatalogEligibilityFilters("items");
    const bindings: unknown[] = [];
    const searchExpression = query.q
      ? this.querySupport.buildCatalogSearchExpression(query.q)
      : undefined;
    if (searchExpression) {
      filters.push("marketplace_app_search MATCH ?");
      bindings.push(searchExpression);
    }
    if (query.tag) {
      filters.push(`EXISTS (
        SELECT 1
        FROM marketplace_app_tags AS app_tags
        WHERE app_tags.item_id = items.id AND app_tags.tag = ?
      )`);
      bindings.push(query.tag);
    }
    if (query.tags?.length) {
      filters.push(`EXISTS (
        SELECT 1
        FROM marketplace_app_tags AS app_tags
        WHERE app_tags.item_id = items.id
          AND app_tags.tag IN (${query.tags.map(() => "?").join(", ")})
      )`);
      bindings.push(...query.tags);
    }
    if (query.publisher) {
      filters.push("items.publisher_id = ?");
      bindings.push(query.publisher);
    }
    if (query.featured !== undefined) {
      filters.push("items.featured = ?");
      bindings.push(query.featured ? 1 : 0);
    }
    const fromClause = searchExpression
      ? `FROM marketplace_app_items AS items
         JOIN marketplace_app_search ON marketplace_app_search.item_id = items.id`
      : "FROM marketplace_app_items AS items";
    return { bindings, filters, fromClause };
  };

  private buildRelevanceCatalogStatement = (
    query: MarketplaceAppCatalogQuery,
    cursor: MarketplaceAppCatalogCursor,
    filters: { bindings: unknown[]; filters: string[]; fromClause: string },
  ): MarketplaceAppCatalogStatement => {
    const bindings = [...filters.bindings];
    const whereClause = `WHERE ${filters.filters.join(" AND ")}`;
    const cursorClause = cursor
      ? `WHERE (
          catalog.relevance > ?
          OR (catalog.relevance = ? AND catalog.updated_at < ?)
          OR (catalog.relevance = ? AND catalog.updated_at = ? AND catalog.id < ?)
        )`
      : "";
    if (cursor) {
      bindings.push(
        cursor.relevance,
        cursor.relevance,
        cursor.updatedAt,
        cursor.relevance,
        cursor.updatedAt,
        cursor.id,
      );
    }
    bindings.push(query.limit + 1);
    return {
      bindings,
      sort: "relevance",
      sql: `
        SELECT *
        FROM (
          SELECT items.*, bm25(marketplace_app_search, 0, 6, 6, 12, 5, 2, 4, 1, 1) AS relevance
          ${filters.fromClause}
          ${whereClause}
        ) AS catalog
        ${cursorClause}
        ORDER BY catalog.relevance ASC, catalog.updated_at DESC, catalog.id DESC
        LIMIT ?
      `,
    };
  };

  private buildOrderedCatalogStatement = (
    query: MarketplaceAppCatalogQuery,
    cursor: MarketplaceAppCatalogCursor,
    sort: Exclude<MarketplaceAppCatalogSort, "relevance">,
    filters: { bindings: unknown[]; filters: string[]; fromClause: string },
  ): MarketplaceAppCatalogStatement => {
    const bindings = [...filters.bindings];
    const whereFilters = [...filters.filters];
    if (cursor && sort === "featured") {
      whereFilters.push(`(
          items.featured < ?
          OR (items.featured = ? AND items.updated_at < ?)
          OR (items.featured = ? AND items.updated_at = ? AND items.id < ?)
        )`);
      bindings.push(
        cursor.featured,
        cursor.featured,
        cursor.updatedAt,
        cursor.featured,
        cursor.updatedAt,
        cursor.id,
      );
    }
    if (cursor && sort === "updated") {
      whereFilters.push(`(
          items.updated_at < ?
          OR (items.updated_at = ? AND items.id < ?)
        )`);
      bindings.push(cursor.updatedAt, cursor.updatedAt, cursor.id);
    }
    const ordering = sort === "featured"
      ? "items.featured DESC, items.updated_at DESC, items.id DESC"
      : "items.updated_at DESC, items.id DESC";
    bindings.push(query.limit + 1);
    return {
      bindings,
      sort,
      sql: `
        SELECT items.*
        ${filters.fromClause}
        WHERE ${whereFilters.join(" AND ")}
        ORDER BY ${ordering}
        LIMIT ?
      `,
    };
  };

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
    const artifactRows = await this.artifactRepository.listRows(itemRow.id);
    return this.recordMapper.mapItemDetail(itemRow, versionRows, artifactRows);
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
        downloadPath: `/api/v1/apps/items/${encodeURIComponent(itemRow.slug)}/files/blob?path=${encodeURIComponent(row.path)}&sha256=${encodeURIComponent(row.sha256)}`,
      })),
    };
  };

  getAppFileContent = async (
    selector: string,
    filePath: string,
    sha256?: string,
  ): Promise<{ item: MarketplaceAppItemSummary; file: MarketplaceAppFileRow; object: R2ObjectBody } | null> => {
    const itemRow = await this.recordRepository.getPublishedPublicItemRow(selector);
    if (!itemRow) {
      return null;
    }
    const fileRow = await this.recordRepository.getFileRow(itemRow.id, filePath);
    if (!fileRow && !sha256) {
      return null;
    }
    const requestedSha256 = sha256 ?? fileRow?.sha256;
    if (!requestedSha256) {
      return null;
    }
    const object = fileRow && requestedSha256 === fileRow.sha256
      ? await this.fileStore.getObject(fileRow.storage_key)
      : await this.fileStore.findContentAddressedObject({
          appId: itemRow.app_id,
          sha256: requestedSha256,
          filePath,
        });
    if (!object) {
      throw new ResourceNotFoundError(`app file object missing: ${selector}/${filePath}`);
    }
    return {
      item: this.recordMapper.mapItemSummary(itemRow),
      file: {
        item_id: itemRow.id,
        path: filePath,
        content_type: fileRow?.content_type ?? this.querySupport.resolveContentType(filePath),
        updated_at: fileRow?.updated_at ?? itemRow.updated_at,
        sha256: requestedSha256,
        size_bytes: object.size,
        storage_key: object.key,
      },
      object,
    };
  };

  getBundle = async (
    selector: string,
    version: string,
    targetKey?: string,
    range?: string,
  ): Promise<{
    item: MarketplaceAppItemSummary;
    version: MarketplaceAppVersionRow;
    artifact?: MarketplaceAppArtifactRow;
    object: R2ObjectBody;
  } | null> => {
    const itemRow = await this.recordRepository.getPublishedPublicItemRow(selector);
    if (!itemRow) {
      return null;
    }
    const versionRow = await this.recordRepository.getVersionRow(itemRow.id, version);
    if (!versionRow) {
      return null;
    }
    const artifactRow = targetKey
      ? await this.artifactRepository.getActiveRow({
          itemId: itemRow.id,
          version,
          targetKey,
        }) ?? undefined
      : undefined;
    if (targetKey && !artifactRow) {
      return null;
    }
    if (!targetKey && !versionRow.bundle_storage_key) {
      return null;
    }
    const object = await this.fileStore.getObject(
      artifactRow?.bundle_storage_key ?? versionRow.bundle_storage_key,
      range,
    );
    if (!object) {
      throw new ResourceNotFoundError(`app bundle object missing: ${selector}@${version}`);
    }
    return {
      item: this.recordMapper.mapItemSummary(itemRow),
      version: versionRow,
      artifact: artifactRow,
      object,
    };
  };

  getRegistryDocument = async (appId: string): Promise<Record<string, unknown> | null> => {
    const itemRow = await this.recordRepository.getPublishedPublicItemRowByAppId(appId);
    if (!itemRow) {
      return null;
    }
    const versionRows = await this.recordRepository.listVersionRows(itemRow.id);
    const artifactRows = await this.artifactRepository.listRows(itemRow.id);
    return {
      name: itemRow.app_id,
      description: itemRow.description ?? undefined,
      "dist-tags": {
        latest: itemRow.latest_version,
      },
      versions: Object.fromEntries(
        versionRows.map((row) => {
          const versionArtifacts = artifactRows.filter((artifact) =>
            artifact.version === row.version && artifact.status === "active",
          );
          return [
            row.version,
            {
            name: itemRow.app_id,
            version: row.version,
            description: row.description ?? itemRow.description ?? undefined,
            publisher: this.recordMapper.readPublisher(itemRow),
            permissions: this.recordMapper.parsePermissions(row.permissions_json, `${itemRow.slug}.permissions_json`),
              dist: versionArtifacts.length > 0
                ? {
                    kind: "targeted-bundle",
                    artifacts: versionArtifacts.map((artifact) => ({
                      target: this.parseStoredTarget(artifact),
                      bundle: this.recordMapper.buildArtifactBundlePath(
                        itemRow.slug,
                        row.version,
                        artifact.target_key,
                        artifact.bundle_sha256,
                      ),
                      sha256: artifact.bundle_sha256,
                      sizeBytes: artifact.size_bytes,
                    })),
                  }
                : {
                    kind: row.distribution_mode,
                    bundle: this.recordMapper.buildBundlePath(
                      itemRow.slug,
                      row.version,
                      row.bundle_sha256,
                    ),
                    sha256: row.bundle_sha256,
                  },
            },
          ];
        }),
      ),
    };
  };

  private parseStoredTarget = (artifact: MarketplaceAppArtifactRow) => {
    try {
      return JSON.parse(artifact.target_json) as Record<string, unknown>;
    } catch {
      throw new ResourceNotFoundError(
        `app artifact target metadata is invalid: ${artifact.item_id}@${artifact.version}/${artifact.target_key}`,
      );
    }
  };
}
