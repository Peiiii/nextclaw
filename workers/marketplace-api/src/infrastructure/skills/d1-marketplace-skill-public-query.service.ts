import { DomainValidationError } from "@/domain/errors";
import type {
  MarketplaceItem,
  MarketplaceItemSummary,
  MarketplaceListQuery,
  MarketplaceListResult,
  MarketplaceRecommendationResult
} from "@/domain/model";
import type { ItemRow } from "./d1-section-types";
import { findSkillMarketplaceSceneTags, listSkillMarketplaceScenes } from "./skill-scenes.config";
import type { MarketplaceSceneView } from "./skill-scenes.config";

type SceneListQuery = MarketplaceListQuery & {
  scene?: string;
};

type SkillPublicQueryDependencies = {
  db: D1Database;
  mapItemRow: (row: ItemRow) => MarketplaceItem;
};

const SKILL_ITEM_COLUMNS = "id, slug, package_name, owner_scope, owner_user_id, owner_visibility, owner_deleted_at, skill_name, publish_status, published_by_type, name, summary, summary_i18n, description, description_i18n, tags, author, source_repo, homepage, install_kind, install_spec, install_command, published_at, updated_at";
const SKILL_ITEM_COLUMNS_WITH_ITEM_ALIAS = SKILL_ITEM_COLUMNS.split(", ").map((column) => `item.${column}`).join(", ");

export class D1MarketplaceSkillPublicQueryService {
  constructor(private readonly dependencies: SkillPublicQueryDependencies) {}

  readonly listPublicSkills = async (query: SceneListQuery): Promise<MarketplaceListResult> => {
    const filters = this.buildPublicSkillFilters(query);
    const countRow = await this.dependencies.db
      .prepare(`
        SELECT COUNT(1) AS count
        FROM marketplace_skill_items
        ${filters.whereClause}
      `)
      .bind(...filters.bindings)
      .first<{ count: number | null }>();

    const total = Number.isFinite(countRow?.count) ? Number(countRow?.count) : 0;
    const totalPages = total > 0 ? Math.ceil(total / query.pageSize) : 0;
    const offset = (query.page - 1) * query.pageSize;
    const rows = await this.dependencies.db
      .prepare(`
        SELECT ${SKILL_ITEM_COLUMNS}
        FROM marketplace_skill_items
        ${filters.whereClause}
        ORDER BY updated_at DESC, id DESC
        LIMIT ? OFFSET ?
      `)
      .bind(...filters.bindings, query.pageSize, offset)
      .all<ItemRow>();

    return {
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages,
      sort: query.sort,
      query: query.q,
      items: (rows.results ?? []).map((row) => this.toSkillSummary(this.dependencies.mapItemRow(row)))
    };
  };

  readonly listSkillScenes = async (): Promise<{ scenes: MarketplaceSceneView[] }> => {
    const counts = new Map<string, number>();
    for (const scene of listSkillMarketplaceScenes(new Map())) {
      const tags = findSkillMarketplaceSceneTags(scene.scene);
      const filters = this.buildPublicSkillFilters({ page: 1, pageSize: 1, sort: "updated", scene: scene.scene });
      if (!tags || tags.length === 0) {
        counts.set(scene.scene, 0);
        continue;
      }
      const countRow = await this.dependencies.db
        .prepare(`
          SELECT COUNT(1) AS count
          FROM marketplace_skill_items
          ${filters.whereClause}
        `)
        .bind(...filters.bindings)
        .first<{ count: number | null }>();
      counts.set(scene.scene, Number.isFinite(countRow?.count) ? Number(countRow?.count) : 0);
    }
    return {
      scenes: listSkillMarketplaceScenes(counts)
    };
  };

  readonly getPublicSkillBySelector = async (selector: string): Promise<MarketplaceItem | null> => {
    const row = await this.dependencies.db
      .prepare(`
        SELECT ${SKILL_ITEM_COLUMNS}
        FROM marketplace_skill_items
        WHERE publish_status = 'published'
          AND COALESCE(owner_visibility, 'public') = 'public'
          AND owner_deleted_at IS NULL
          AND (slug = ? OR package_name = ?)
        LIMIT 1
      `)
      .bind(selector, selector)
      .first<ItemRow>();

    return row ? this.dependencies.mapItemRow(row) : null;
  };

  readonly listSkillRecommendations = async (
    sceneId: string | undefined,
    limit: number
  ): Promise<MarketplaceRecommendationResult> => {
    const selectedScene = await this.findRecommendationScene(sceneId);
    if (!selectedScene) {
      return {
        type: "skill",
        sceneId: sceneId ?? "default",
        title: sceneId ?? "Recommendations",
        total: 0,
        items: []
      };
    }

    const rows = await this.dependencies.db
      .prepare(`
        SELECT ${SKILL_ITEM_COLUMNS_WITH_ITEM_ALIAS}
        FROM marketplace_skill_recommendation_items scene_item
        JOIN marketplace_skill_items item ON item.id = scene_item.item_id
        WHERE scene_item.scene_id = ?
          AND item.publish_status = 'published'
          AND COALESCE(item.owner_visibility, 'public') = 'public'
          AND item.owner_deleted_at IS NULL
        ORDER BY scene_item.sort_order ASC, item.updated_at DESC, item.id DESC
        LIMIT ?
      `)
      .bind(selectedScene.id, limit)
      .all<ItemRow>();

    const items = (rows.results ?? []).map((row) => this.toSkillSummary(this.dependencies.mapItemRow(row)));
    return {
      type: "skill",
      sceneId: selectedScene.id,
      title: selectedScene.title,
      description: selectedScene.description ?? undefined,
      total: items.length,
      items
    };
  };

  private findRecommendationScene = async (
    sceneId: string | undefined
  ): Promise<{ id: string; title: string; description: string | null } | null> => {
    if (!sceneId) {
      return await this.dependencies.db
        .prepare(`
          SELECT id, title, description
          FROM marketplace_skill_recommendation_scenes
          ORDER BY id ASC
          LIMIT 1
        `)
        .first<{ id: string; title: string; description: string | null }>();
    }

    return await this.dependencies.db
      .prepare(`
        SELECT id, title, description
        FROM marketplace_skill_recommendation_scenes
        WHERE id = ? OR id = ?
        ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END
        LIMIT 1
      `)
      .bind(sceneId, `skills-${sceneId}`, sceneId)
      .first<{ id: string; title: string; description: string | null }>();
  };

  private buildPublicSkillFilters = (query: SceneListQuery): { whereClause: string; bindings: unknown[] } => {
    const clauses = [
      "publish_status = 'published'",
      "COALESCE(owner_visibility, 'public') = 'public'",
      "owner_deleted_at IS NULL"
    ];
    const bindings: unknown[] = [];
    const normalizedQuery = query.q?.trim().toLowerCase();
    if (normalizedQuery) {
      clauses.push(`(
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
    if (query.tag) {
      clauses.push("LOWER(tags) LIKE ?");
      bindings.push(`%"${query.tag.toLowerCase()}"%`);
    }
    const sceneTags = findSkillMarketplaceSceneTags(query.scene);
    if (sceneTags) {
      if (sceneTags.length === 0) {
        clauses.push("1 = 0");
      } else {
        clauses.push(`(${sceneTags.map(() => "LOWER(tags) LIKE ?").join(" OR ")})`);
        bindings.push(...sceneTags.map((tag) => `%"${tag.toLowerCase()}"%`));
      }
    }
    return {
      whereClause: `WHERE ${clauses.join(" AND ")}`,
      bindings
    };
  };

  private toSkillSummary = (item: MarketplaceItem): MarketplaceItemSummary => {
    if (item.type !== "skill") {
      throw new DomainValidationError(`skill list received non-skill item: ${item.slug}`);
    }
    return {
      id: item.id,
      slug: item.slug,
      name: item.name,
      summary: item.summary,
      summaryI18n: item.summaryI18n,
      tags: item.tags,
      author: item.author,
      updatedAt: item.updatedAt,
      type: "skill",
      packageName: item.packageName,
      ownerScope: item.ownerScope,
      skillName: item.skillName,
      publishStatus: item.publishStatus,
      publishedByType: item.publishedByType,
      install: item.install
    };
  };
}
