import { DomainValidationError } from "../../domain/errors";
import type { MarketplaceItem, MarketplaceSkillInstallSpec } from "../../domain/model";
import { normalizeRelativeFilePath, type MarketplaceSkillReviewInput } from "./marketplace-skill-payload";
import type { ItemRow, MarketplaceSkillFile, SkillFileRow } from "./d1-section-types";
import type { MarketplaceSkillFileStore } from "./marketplace-skill-file-store";

export type MarketplaceAdminSkillPublishStatus = "pending" | "published" | "rejected" | "all";

export type MarketplaceAdminSkillListQuery = {
  publishStatus: MarketplaceAdminSkillPublishStatus;
  q?: string;
  page: number;
  pageSize: number;
};

export type MarketplaceAdminSkillCounts = {
  pending: number;
  published: number;
  rejected: number;
};

export type MarketplaceAdminSkillSummary = {
  id: string;
  slug: string;
  packageName: string;
  ownerScope: string;
  skillName: string;
  name: string;
  summary: string;
  author: string;
  tags: string[];
  publishStatus: "pending" | "published" | "rejected";
  publishedByType: "admin" | "user";
  reviewNote?: string;
  reviewedAt?: string;
  publishedAt: string;
  updatedAt: string;
};

export type MarketplaceAdminSkillDetail = MarketplaceAdminSkillSummary & {
  summaryI18n: Record<string, string>;
  description?: string;
  descriptionI18n?: Record<string, string>;
  sourceRepo?: string;
  homepage?: string;
  install: MarketplaceSkillInstallSpec;
};

type D1MarketplaceSkillAdminSupportDependencies = {
  db: D1Database;
  fileStore: MarketplaceSkillFileStore;
  mapItemRow: (row: ItemRow) => MarketplaceItem;
  parseStringArray: (raw: string, path: string) => string[];
  parseLocalizedMap: (raw: string | null, path: string, fallbackEn: string) => Record<string, string>;
  mapInstall: (type: "skill", kind: string, spec: string, command: string, slug: string) => MarketplaceSkillInstallSpec;
  readSkillPublishStatus: (value: string | null | undefined) => "pending" | "published" | "rejected";
  readSkillPublishedByType: (value: string | null | undefined) => "admin" | "user";
};

export class D1MarketplaceSkillAdminSupport {
  constructor(private readonly dependencies: D1MarketplaceSkillAdminSupportDependencies) {}

  getSkillFiles = async (
    selector: string,
    options: { includeUnpublished?: boolean }
  ): Promise<{
    item: MarketplaceItem;
    files: MarketplaceSkillFile[];
  } | null> => {
    const item = await this.getSkillItemBySelector(selector, options);
    if (!item) {
      return null;
    }

    const files = await this.dependencies.fileStore.listItemFileRows(item.id);
    const metadata = await Promise.all(files.map(async (row) => {
      const resolvedSizeBytes = Number.isFinite(row.size_bytes)
        ? Number(row.size_bytes)
        : row.content_b64
          ? this.dependencies.fileStore.mapSkillFileMetadata(row).sizeBytes
          : undefined;
      return this.dependencies.fileStore.mapSkillFileMetadata(row, resolvedSizeBytes);
    }));

    return {
      item,
      files: metadata
    };
  };

  getSkillFileContent = async (
    selector: string,
    filePath: string,
    options: { includeUnpublished?: boolean }
  ): Promise<{
    item: MarketplaceItem;
    file: MarketplaceSkillFile;
    bytes: Uint8Array;
  } | null> => {
    const item = await this.getSkillItemBySelector(selector, options);
    if (!item) {
      return null;
    }

    const row = await this.dependencies.db
      .prepare(`
        SELECT file_path, content_b64, content_sha256, updated_at, storage_backend, r2_key, size_bytes
        FROM marketplace_skill_files
        WHERE skill_item_id = ? AND file_path = ?
        LIMIT 1
      `)
      .bind(item.id, normalizeRelativeFilePath(filePath, "query.path"))
      .first<SkillFileRow>();

    if (!row) {
      return null;
    }

    const bytes = await this.dependencies.fileStore.readSkillFileBytes(item.id, row);
    return {
      item,
      file: this.dependencies.fileStore.mapSkillFileMetadata(row, bytes.byteLength),
      bytes
    };
  };

  listAdminSkills = async (query: MarketplaceAdminSkillListQuery): Promise<{
    counts: MarketplaceAdminSkillCounts;
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    publishStatus: MarketplaceAdminSkillPublishStatus;
    query?: string;
    items: MarketplaceAdminSkillSummary[];
  }> => {
    const counts = await this.countAdminSkillsByStatus();
    const filters: string[] = [];
    const bindings: unknown[] = [];
    const normalizedQuery = query.q?.trim().toLowerCase();
    if (query.publishStatus !== "all") {
      filters.push("publish_status = ?");
      bindings.push(query.publishStatus);
    }
    if (normalizedQuery) {
      filters.push(`(
        LOWER(name) LIKE ?
        OR LOWER(slug) LIKE ?
        OR LOWER(package_name) LIKE ?
        OR LOWER(summary) LIKE ?
        OR LOWER(author) LIKE ?
        OR LOWER(tags) LIKE ?
      )`);
      const wildcard = `%${normalizedQuery}%`;
      bindings.push(wildcard, wildcard, wildcard, wildcard, wildcard, wildcard);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
    const countRow = await this.dependencies.db
      .prepare(`
        SELECT COUNT(1) AS count
        FROM marketplace_skill_items
        ${whereClause}
      `)
      .bind(...bindings)
      .first<{ count: number | null }>();

    const total = Number.isFinite(countRow?.count) ? Number(countRow?.count) : 0;
    const totalPages = total > 0 ? Math.ceil(total / query.pageSize) : 0;
    const offset = (query.page - 1) * query.pageSize;
    const rows = await this.dependencies.db
      .prepare(`
        SELECT
          id,
          slug,
          package_name,
          owner_scope,
          skill_name,
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
          install_kind,
          install_spec,
          install_command,
          published_at,
          updated_at
        FROM marketplace_skill_items
        ${whereClause}
        ORDER BY updated_at DESC, id DESC
        LIMIT ? OFFSET ?
      `)
      .bind(...bindings, query.pageSize, offset)
      .all<ItemRow>();

    return {
      counts,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages,
      publishStatus: query.publishStatus,
      query: normalizedQuery || undefined,
      items: (rows.results ?? []).map((row) => this.mapAdminSkillSummary(row))
    };
  };

  getAdminSkillDetail = async (selector: string): Promise<{
    item: MarketplaceAdminSkillDetail;
    files: MarketplaceSkillFile[];
    skillMarkdownRaw?: string;
    marketplaceJsonRaw?: string;
  } | null> => {
    const row = await this.getSkillRowBySelector(selector, { includeUnpublished: true });
    if (!row) {
      return null;
    }

    const filesPayload = await this.getSkillFiles(row.package_name ?? row.slug, { includeUnpublished: true });
    const skillMarkdown = await this.readOptionalTextFile(row.package_name ?? row.slug, ["SKILL.md", "skill.md"]);
    const marketplaceJson = await this.readOptionalTextFile(row.package_name ?? row.slug, ["marketplace.json"]);

    return {
      item: this.mapAdminSkillDetail(row),
      files: filesPayload?.files ?? [],
      skillMarkdownRaw: skillMarkdown ?? undefined,
      marketplaceJsonRaw: marketplaceJson ?? undefined
    };
  };

  reviewSkill = async (input: MarketplaceSkillReviewInput): Promise<MarketplaceAdminSkillDetail> => {
    const row = await this.getSkillRowBySelector(input.selector, { includeUnpublished: true });
    if (!row) {
      throw new DomainValidationError(`skill item not found: ${input.selector}`);
    }

    const updatedAt = new Date().toISOString();
    await this.dependencies.db
      .prepare(`
        UPDATE marketplace_skill_items
        SET publish_status = ?, review_note = ?, reviewed_at = ?, updated_at = ?
        WHERE id = ?
      `)
      .bind(input.publishStatus, input.reviewNote ?? null, updatedAt, updatedAt, row.id)
      .run();

    const nextRow = await this.getSkillRowBySelector(row.package_name ?? row.slug, { includeUnpublished: true });
    if (!nextRow) {
      throw new DomainValidationError(`review succeeded but item not found: ${row.package_name ?? row.slug}`);
    }
    return this.mapAdminSkillDetail(nextRow);
  };

  private countAdminSkillsByStatus = async (): Promise<MarketplaceAdminSkillCounts> => {
    const rows = await this.dependencies.db
      .prepare(`
        SELECT publish_status, COUNT(1) AS count
        FROM marketplace_skill_items
        GROUP BY publish_status
      `)
      .all<{ publish_status: string | null; count: number | null }>();

    const counts: MarketplaceAdminSkillCounts = {
      pending: 0,
      published: 0,
      rejected: 0
    };

    for (const row of rows.results ?? []) {
      const status = this.dependencies.readSkillPublishStatus(row.publish_status);
      counts[status] = Number.isFinite(row.count) ? Number(row.count) : 0;
    }

    return counts;
  };

  private mapAdminSkillSummary = (row: ItemRow): MarketplaceAdminSkillSummary => {
    return {
      id: row.id,
      slug: row.slug,
      packageName: row.package_name ?? `@nextclaw/${row.slug}`,
      ownerScope: row.owner_scope ?? "nextclaw",
      skillName: row.skill_name ?? row.slug,
      name: row.name,
      summary: row.summary,
      author: row.author,
      tags: this.dependencies.parseStringArray(row.tags, `marketplace_skill_items.tags(${row.slug})`),
      publishStatus: this.dependencies.readSkillPublishStatus(row.publish_status),
      publishedByType: this.dependencies.readSkillPublishedByType(row.published_by_type),
      reviewNote: row.review_note ?? undefined,
      reviewedAt: row.reviewed_at ?? undefined,
      publishedAt: row.published_at,
      updatedAt: row.updated_at
    };
  };

  private mapAdminSkillDetail = (row: ItemRow): MarketplaceAdminSkillDetail => {
    const summaryI18n = this.dependencies.parseLocalizedMap(row.summary_i18n, `marketplace_skill_items.summary_i18n(${row.slug})`, row.summary);
    const description = row.description ?? undefined;
    const descriptionI18n = description
      ? this.dependencies.parseLocalizedMap(row.description_i18n, `marketplace_skill_items.description_i18n(${row.slug})`, description)
      : undefined;

    return {
      ...this.mapAdminSkillSummary(row),
      summaryI18n,
      description,
      descriptionI18n,
      sourceRepo: row.source_repo ?? undefined,
      homepage: row.homepage ?? undefined,
      install: this.dependencies.mapInstall("skill", row.install_kind, row.install_spec, row.install_command, row.slug)
    };
  };

  private readOptionalTextFile = async (selector: string, paths: string[]): Promise<string | null> => {
    for (const path of paths) {
      const payload = await this.getSkillFileContent(selector, path, { includeUnpublished: true });
      if (payload) {
        return new TextDecoder().decode(payload.bytes);
      }
    }
    return null;
  };

  private getSkillItemBySelector = async (
    selector: string,
    options: { includeUnpublished?: boolean } = {}
  ): Promise<MarketplaceItem | null> => {
    const row = await this.getSkillRowBySelector(selector, options);
    if (!row) {
      return null;
    }

    return this.dependencies.mapItemRow(row);
  };

  private getSkillRowBySelector = async (
    selector: string,
    options: { includeUnpublished?: boolean } = {}
  ): Promise<ItemRow | null> => {
    const filters = [
      "(slug = ? OR package_name = ?)"
    ];
    if (!options.includeUnpublished) {
      filters.push("publish_status = 'published'");
    }
    const row = await this.dependencies.db
      .prepare(`
        SELECT
          id,
          slug,
          package_name,
          owner_scope,
          skill_name,
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
          install_kind,
          install_spec,
          install_command,
          published_at,
          updated_at
        FROM marketplace_skill_items
        WHERE ${filters.join(" AND ")}
        LIMIT 1
      `)
      .bind(selector, selector)
      .first<ItemRow>();

    return row ?? null;
  };
}
