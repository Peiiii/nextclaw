import { DomainValidationError } from "../../domain/errors";
import type { MarketplaceSkillInstallSpec } from "../../domain/model";
import type { ItemRow } from "./d1-section-types";

export type MarketplaceOwnerSkillVisibility = "public" | "hidden";
export type MarketplaceOwnerSkillManageAction = "hide" | "show" | "delete";

export type MarketplaceOwnerSkillListQuery = {
  ownerUserId: string;
  q?: string;
};

export type MarketplaceOwnerSkillManageInput = {
  selector: string;
  ownerUserId: string;
  action: MarketplaceOwnerSkillManageAction;
};

export type MarketplaceOwnerSkillSummary = {
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
  ownerVisibility: MarketplaceOwnerSkillVisibility;
  reviewNote?: string;
  reviewedAt?: string;
  publishedAt: string;
  updatedAt: string;
};

export type MarketplaceOwnerSkillDetail = MarketplaceOwnerSkillSummary & {
  summaryI18n: Record<string, string>;
  description?: string;
  descriptionI18n?: Record<string, string>;
  sourceRepo?: string;
  homepage?: string;
  install: MarketplaceSkillInstallSpec;
  canShow: boolean;
  canHide: boolean;
  canDelete: boolean;
};

type D1MarketplaceSkillOwnerSupportDependencies = {
  db: D1Database;
  mapInstall: (type: "skill", kind: string, spec: string, command: string, slug: string) => MarketplaceSkillInstallSpec;
  parseStringArray: (raw: string, path: string) => string[];
  parseLocalizedMap: (raw: string | null, path: string, fallbackEn: string) => Record<string, string>;
  readSkillPublishStatus: (value: string | null | undefined) => "pending" | "published" | "rejected";
  readSkillPublishedByType: (value: string | null | undefined) => "admin" | "user";
  readSkillOwnerVisibility: (value: string | null | undefined) => MarketplaceOwnerSkillVisibility;
};

export class D1MarketplaceSkillOwnerSupport {
  constructor(private readonly dependencies: D1MarketplaceSkillOwnerSupportDependencies) {}

  listOwnerSkills = async (query: MarketplaceOwnerSkillListQuery): Promise<{ total: number; items: MarketplaceOwnerSkillSummary[] }> => {
    const filters = [
      "owner_user_id = ?",
      "owner_deleted_at IS NULL"
    ];
    const bindings: unknown[] = [query.ownerUserId];
    const normalizedQuery = query.q?.trim().toLowerCase();

    if (normalizedQuery) {
      filters.push(`(
        LOWER(name) LIKE ?
        OR LOWER(slug) LIKE ?
        OR LOWER(package_name) LIKE ?
        OR LOWER(summary) LIKE ?
        OR LOWER(tags) LIKE ?
      )`);
      const wildcard = `%${normalizedQuery}%`;
      bindings.push(wildcard, wildcard, wildcard, wildcard, wildcard);
    }

    const whereClause = `WHERE ${filters.join(" AND ")}`;
    const rows = await this.dependencies.db
      .prepare(`
        SELECT
          id,
          slug,
          package_name,
          owner_scope,
          owner_user_id,
          owner_visibility,
          owner_deleted_at,
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
      `)
      .bind(...bindings)
      .all<ItemRow>();

    const items = (rows.results ?? []).map((row) => this.mapOwnerSkillSummary(row));
    return {
      total: items.length,
      items
    };
  };

  getOwnerSkillDetail = async (selector: string, ownerUserId: string): Promise<MarketplaceOwnerSkillDetail | null> => {
    const row = await this.getOwnerSkillRow(selector, ownerUserId);
    if (!row) {
      return null;
    }
    return this.mapOwnerSkillDetail(row);
  };

  manageOwnerSkill = async (input: MarketplaceOwnerSkillManageInput): Promise<MarketplaceOwnerSkillDetail> => {
    const row = await this.getOwnerSkillRow(input.selector, input.ownerUserId);
    if (!row) {
      throw new DomainValidationError(`skill item not found: ${input.selector}`);
    }

    const nowIso = new Date().toISOString();
    if (input.action === "hide") {
      await this.dependencies.db
        .prepare(`
          UPDATE marketplace_skill_items
          SET owner_visibility = 'hidden', updated_at = ?
          WHERE id = ?
        `)
        .bind(nowIso, row.id)
        .run();
    } else if (input.action === "show") {
      await this.dependencies.db
        .prepare(`
          UPDATE marketplace_skill_items
          SET owner_visibility = 'public', updated_at = ?
          WHERE id = ?
        `)
        .bind(nowIso, row.id)
        .run();
    } else if (input.action === "delete") {
      await this.dependencies.db
        .prepare(`
          UPDATE marketplace_skill_items
          SET owner_deleted_at = ?, updated_at = ?
          WHERE id = ?
        `)
        .bind(nowIso, nowIso, row.id)
        .run();
    } else {
      throw new DomainValidationError(`unsupported owner skill action: ${input.action}`);
    }

    const nextRow = await this.getOwnerSkillRow(row.package_name ?? row.slug, input.ownerUserId, { includeDeleted: true });
    if (!nextRow) {
      throw new DomainValidationError(`skill action succeeded but item not found: ${row.package_name ?? row.slug}`);
    }

    return this.mapOwnerSkillDetail(nextRow);
  };

  private getOwnerSkillRow = async (
    selector: string,
    ownerUserId: string,
    options: { includeDeleted?: boolean } = {}
  ): Promise<ItemRow | null> => {
    const filters = [
      "owner_user_id = ?",
      "(slug = ? OR package_name = ?)"
    ];
    const bindings: unknown[] = [ownerUserId, selector, selector];
    if (!options.includeDeleted) {
      filters.push("owner_deleted_at IS NULL");
    }

    const row = await this.dependencies.db
      .prepare(`
        SELECT
          id,
          slug,
          package_name,
          owner_scope,
          owner_user_id,
          owner_visibility,
          owner_deleted_at,
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
      .bind(...bindings)
      .first<ItemRow>();

    return row ?? null;
  };

  private mapOwnerSkillSummary = (row: ItemRow): MarketplaceOwnerSkillSummary => {
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
      ownerVisibility: this.dependencies.readSkillOwnerVisibility(row.owner_visibility),
      reviewNote: row.review_note ?? undefined,
      reviewedAt: row.reviewed_at ?? undefined,
      publishedAt: row.published_at,
      updatedAt: row.updated_at
    };
  };

  private mapOwnerSkillDetail = (row: ItemRow): MarketplaceOwnerSkillDetail => {
    const summaryI18n = this.dependencies.parseLocalizedMap(
      row.summary_i18n,
      `marketplace_skill_items.summary_i18n(${row.slug})`,
      row.summary
    );
    const description = row.description ?? undefined;
    const descriptionI18n = description
      ? this.dependencies.parseLocalizedMap(
          row.description_i18n,
          `marketplace_skill_items.description_i18n(${row.slug})`,
          description
        )
      : undefined;
    const ownerVisibility = this.dependencies.readSkillOwnerVisibility(row.owner_visibility);
    const isDeleted = Boolean(row.owner_deleted_at);

    return {
      ...this.mapOwnerSkillSummary(row),
      summaryI18n,
      description,
      descriptionI18n,
      sourceRepo: row.source_repo ?? undefined,
      homepage: row.homepage ?? undefined,
      install: this.dependencies.mapInstall("skill", row.install_kind, row.install_spec, row.install_command, row.slug),
      canShow: !isDeleted && ownerVisibility === "hidden",
      canHide: !isDeleted && ownerVisibility === "public",
      canDelete: !isDeleted
    };
  };
}
