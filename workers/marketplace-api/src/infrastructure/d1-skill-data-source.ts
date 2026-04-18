import { DomainValidationError } from "../domain/errors";
import type { MarketplaceCatalogSection, MarketplaceItem, MarketplaceItemType, MarketplaceSkillInstallSpec } from "../domain/model";
import { D1MarketplaceSectionDataSourceBase } from "./d1-section-data-source-base";
import { MarketplaceSkillFileStore } from "./skills/marketplace-skill-file-store";
import {
  D1MarketplaceSkillAdminSupport,
  type MarketplaceAdminSkillDetail,
  type MarketplaceAdminSkillListQuery
} from "./skills/d1-marketplace-skill-admin-support";
import {
  D1MarketplaceSkillOwnerSupport,
  type MarketplaceOwnerSkillDetail,
  type MarketplaceOwnerSkillListQuery,
  type MarketplaceOwnerSkillManageInput
} from "./skills/d1-marketplace-skill-owner-support";
import {
  assertExistingSkillOwnership,
  parseSkillReviewInput,
  parseSkillUpsertInput,
  resolveSkillIdentity,
  type ExistingSkillRow,
  type MarketplaceResolvedSkillIdentity
} from "./skills/marketplace-skill-payload";
import type {
  ItemRow,
  MarketplaceSkillFile,
  MarketplaceSkillPublishActor,
  MarketplaceSkillUpsertInput,
  SceneRow,
  TableNames
} from "./skills/d1-section-types";

type SkillUpsertContext = { existing: ExistingSkillRow | null; itemId: string; publishedAt: string; updatedAt: string; publishStatus: "pending" | "published"; publishedByType: "admin" | "user"; authorLabel: string; install: MarketplaceSkillInstallSpec; };

export class D1MarketplaceSkillDataSource extends D1MarketplaceSectionDataSourceBase {
  private readonly fileStore: MarketplaceSkillFileStore;
  private readonly adminSupport: D1MarketplaceSkillAdminSupport;
  private readonly ownerSupport: D1MarketplaceSkillOwnerSupport;
  constructor(db: D1Database, filesBucket: R2Bucket) {
    super(db);
    this.fileStore = new MarketplaceSkillFileStore(db, filesBucket, (raw, path) => this.decodeBase64(raw, path), (bytes) => this.sha256Hex(bytes));
    this.adminSupport = new D1MarketplaceSkillAdminSupport({
      db,
      fileStore: this.fileStore,
      mapItemRow: this.mapItemRow,
      parseStringArray: this.parseStringArray,
      parseLocalizedMap: this.parseLocalizedMap,
      mapInstall: (type, kind, spec, command, slug) => this.mapInstall(type, kind, spec, command, slug) as MarketplaceSkillInstallSpec,
      readSkillPublishStatus: this.readSkillPublishStatus,
      readSkillPublishedByType: this.readSkillPublishedByType
    });
    this.ownerSupport = new D1MarketplaceSkillOwnerSupport({
      db,
      mapInstall: (type, kind, spec, command, slug) => this.mapInstall(type, kind, spec, command, slug) as MarketplaceSkillInstallSpec,
      parseStringArray: this.parseStringArray,
      parseLocalizedMap: this.parseLocalizedMap,
      readSkillPublishStatus: this.readSkillPublishStatus,
      readSkillPublishedByType: this.readSkillPublishedByType,
      readSkillOwnerVisibility: this.readSkillOwnerVisibility
    });
  }

  protected getItemType = (): MarketplaceItemType => {
    return "skill";
  };

  protected getTables = (): TableNames => {
    return {
      items: "marketplace_skill_items",
      scenes: "marketplace_skill_recommendation_scenes",
      sceneItems: "marketplace_skill_recommendation_items"
    };
  };

  override loadSection = async (): Promise<MarketplaceCatalogSection> => {
    const itemsResult = await this.db
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
        WHERE publish_status = 'published'
          AND COALESCE(owner_visibility, 'public') = 'public'
          AND owner_deleted_at IS NULL
      `)
      .all<ItemRow>();

    const sceneResult = await this.db
      .prepare(`
        SELECT
          s.id AS scene_id,
          s.title,
          s.description,
          i.item_id
        FROM marketplace_skill_recommendation_scenes s
        LEFT JOIN marketplace_skill_recommendation_items i ON i.scene_id = s.id
        ORDER BY s.id ASC, i.sort_order ASC
      `)
      .all<SceneRow>();

    const items = (itemsResult.results ?? []).map((row) => this.mapItemRow(row));
    const recommendations = this.mapScenes(sceneResult.results ?? [], items);

    return {
      items,
      recommendations
    };
  };

  getSkillFilesBySlug = async (selector: string): Promise<{
    item: MarketplaceItem;
    files: MarketplaceSkillFile[];
  } | null> => {
    return await this.adminSupport.getSkillFiles(selector, { includeUnpublished: false });
  };

  getSkillFileContentBySlug = async (selector: string, filePath: string): Promise<{
    item: MarketplaceItem;
    file: MarketplaceSkillFile;
    bytes: Uint8Array;
  } | null> => {
    return await this.adminSupport.getSkillFileContent(selector, filePath, { includeUnpublished: false });
  };

  listAdminSkills = async (query: MarketplaceAdminSkillListQuery) => {
    return await this.adminSupport.listAdminSkills(query);
  };

  getAdminSkillDetail = async (selector: string) => {
    return await this.adminSupport.getAdminSkillDetail(selector);
  };

  listOwnerSkills = async (query: MarketplaceOwnerSkillListQuery) => {
    return await this.ownerSupport.listOwnerSkills(query);
  };

  getOwnerSkillDetail = async (selector: string, ownerUserId: string) => {
    return await this.ownerSupport.getOwnerSkillDetail(selector, ownerUserId);
  };

  manageOwnerSkill = async (input: MarketplaceOwnerSkillManageInput): Promise<MarketplaceOwnerSkillDetail> => {
    return await this.ownerSupport.manageOwnerSkill(input);
  };

  upsertSkill = async (
    rawInput: unknown,
    actor: MarketplaceSkillPublishActor
  ): Promise<{ created: boolean; item: MarketplaceItem; fileCount: number }> => {
    const input = parseSkillUpsertInput(rawInput, this.validationTools);
    const resolvedIdentity = resolveSkillIdentity(input, actor);
    const context = await this.resolveSkillUpsertContext(input, actor, resolvedIdentity);

    await this.persistSkillItem({
      input,
      identity: resolvedIdentity,
      context
    });
    await this.fileStore.replaceSkillFiles(context.itemId, input.files, context.updatedAt);
    await this.ensureDefaultSkillRecommendation(context.itemId);

    const item = await this.getSkillItemBySelector(resolvedIdentity.packageName, { includeUnpublished: true });
    if (!item) {
      throw new DomainValidationError(`upsert succeeded but item not found: ${resolvedIdentity.packageName}`);
    }

    return {
      created: !context.existing,
      item,
      fileCount: input.files.length
    };
  };

  reviewSkill = async (rawInput: unknown): Promise<MarketplaceAdminSkillDetail> => {
    const input = parseSkillReviewInput(rawInput, this.validationTools);
    return await this.adminSupport.reviewSkill(input);
  };

  private resolveSkillUpsertContext = async (
    input: MarketplaceSkillUpsertInput,
    actor: MarketplaceSkillPublishActor,
    identity: MarketplaceResolvedSkillIdentity
  ): Promise<SkillUpsertContext> => {
    const existing = await this.db
      .prepare(`
        SELECT id, package_name, owner_scope, skill_name, owner_user_id, published_at
        FROM marketplace_skill_items
        WHERE package_name = ?
        LIMIT 1
      `)
      .bind(identity.packageName)
      .first<ExistingSkillRow>();

    if (input.requireExisting && !existing) {
      throw new DomainValidationError(`skill does not exist yet: ${identity.packageName}`);
    }
    if (existing) {
      assertExistingSkillOwnership(existing, identity, actor);
    }

    const nowIso = new Date().toISOString();
    const itemId = existing?.id ?? input.id ?? `skill-${identity.ownerScope}-${identity.skillName}`;
    const publishedAt = input.publishedAt ?? existing?.published_at ?? nowIso;
    const updatedAt = input.updatedAt ?? nowIso;
    return {
      existing: existing ?? null,
      itemId,
      publishedAt,
      updatedAt,
      publishStatus: identity.ownerScope === "nextclaw" ? "published" : "pending",
      publishedByType: identity.ownerScope === "nextclaw" ? "admin" : "user",
      authorLabel: identity.ownerScope === "nextclaw" ? "NextClaw" : (actor.username ?? "unknown"),
      install: {
        kind: "marketplace",
        spec: identity.packageName,
        command: `nextclaw skills install ${identity.packageName}`
      }
    };
  };

  private persistSkillItem = async (params: {
    input: MarketplaceSkillUpsertInput;
    identity: MarketplaceResolvedSkillIdentity;
    context: SkillUpsertContext;
  }): Promise<void> => {
    const { input, identity, context } = params;
    await this.db
      .prepare(`
        INSERT INTO marketplace_skill_items (
          id, slug, package_name, owner_user_id, owner_scope, skill_name,
          publish_status, published_by_type, owner_visibility, owner_deleted_at, review_note, reviewed_at,
          name, summary, summary_i18n, description, description_i18n,
          tags, author, source_repo, homepage, install_kind, install_spec, install_command,
          published_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(package_name) DO UPDATE SET
          slug = excluded.slug,
          owner_user_id = excluded.owner_user_id,
          owner_scope = excluded.owner_scope,
          skill_name = excluded.skill_name,
          publish_status = excluded.publish_status,
          published_by_type = excluded.published_by_type,
          owner_visibility = excluded.owner_visibility,
          owner_deleted_at = excluded.owner_deleted_at,
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
          install_kind = excluded.install_kind,
          install_spec = excluded.install_spec,
          install_command = excluded.install_command,
          updated_at = excluded.updated_at
      `)
      .bind(
        context.itemId,
        identity.slug,
        identity.packageName,
        identity.ownerUserId,
        identity.ownerScope,
        identity.skillName,
        context.publishStatus,
        context.publishedByType,
        "public",
        null,
        null,
        null,
        input.name,
        input.summary,
        JSON.stringify(input.summaryI18n),
        input.description ?? null,
        input.descriptionI18n ? JSON.stringify(input.descriptionI18n) : null,
        JSON.stringify(input.tags),
        context.authorLabel,
        input.sourceRepo ?? null,
        input.homepage ?? null,
        context.install.kind,
        context.install.spec,
        context.install.command,
        context.publishedAt,
        context.updatedAt
      )
      .run();
  };

  private ensureDefaultSkillRecommendation = async (itemId: string): Promise<void> => {
    const sceneId = "skills-default";
    await this.db
      .prepare(`
        INSERT OR IGNORE INTO marketplace_skill_recommendation_scenes (id, title, description)
        VALUES (?, ?, ?)
      `)
      .bind(sceneId, "Recommended Skills", "Curated skill list")
      .run();

    const maxSortRow = await this.db
      .prepare("SELECT MAX(sort_order) AS max_sort FROM marketplace_skill_recommendation_items WHERE scene_id = ?")
      .bind(sceneId)
      .first<{ max_sort: number | null }>();

    const nextSort = Number.isFinite(maxSortRow?.max_sort) ? Number(maxSortRow?.max_sort) + 1 : 0;

    await this.db
      .prepare(`
        INSERT OR IGNORE INTO marketplace_skill_recommendation_items (scene_id, item_id, sort_order)
        VALUES (?, ?, ?)
      `)
      .bind(sceneId, itemId, nextSort)
      .run();
  };

  private getSkillItemBySelector = async (
    selector: string,
    options: { includeUnpublished?: boolean } = {}
  ): Promise<MarketplaceItem | null> => {
    const payload = await this.adminSupport.getSkillFiles(selector, options);
    return payload?.item ?? null;
  };

  private get validationTools() {
    return {
      isRecord: (value: unknown): value is Record<string, unknown> => this.isRecord(value),
      readSlug: (value: unknown, path: string) => this.readSlug(value, path),
      readString: (value: unknown, path: string) => this.readString(value, path),
      readOptionalString: (value: unknown, path: string) => this.readOptionalString(value, path),
      readLocalizedTextMap: (value: unknown, path: string, fallbackEn: string) => this.readLocalizedTextMap(value, path, fallbackEn),
      readStringArray: (value: unknown, path: string) => this.readStringArray(value, path),
      readOptionalDateTime: (value: unknown, path: string) => this.readOptionalDateTime(value, path),
      decodeBase64: (raw: string, path: string) => this.decodeBase64(raw, path)
    };
  }
}
