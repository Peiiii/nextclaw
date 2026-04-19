import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { SkillsLoader, type SkillInfo, type SkillScope } from "@nextclaw/core";
import { parseSkillFrontmatter, type LocalizedTextMap } from "./marketplace.metadata.js";
import { readMarketplaceEnvelope, resolveMarketplaceApiBase } from "./marketplace-client.js";
import { runWithMarketplaceNetworkRetry } from "./marketplace-network-retry.js";

type InstalledSkillScopeFilter = SkillScope | "all";
type MarketplaceSkillSort = "relevance" | "updated";
type MarketplaceSkillInstallKind = "builtin" | "marketplace";

type MarketplaceInstallSpec = {
  kind: MarketplaceSkillInstallKind;
  spec: string;
  command: string;
};

type MarketplaceSkillItemSummary = {
  id: string;
  slug: string;
  type: "skill";
  name: string;
  summary: string;
  summaryI18n: LocalizedTextMap;
  tags: string[];
  author: string;
  install: MarketplaceInstallSpec;
  updatedAt: string;
};

type MarketplaceSkillItemView = MarketplaceSkillItemSummary & {
  description?: string;
  descriptionI18n?: LocalizedTextMap;
  sourceRepo?: string;
  homepage?: string;
  publishedAt: string;
};

type MarketplaceSkillContentView = {
  type: "skill";
  slug: string;
  name: string;
  install: MarketplaceInstallSpec;
  source: "builtin" | "marketplace" | "remote";
  raw: string;
  metadataRaw?: string;
  bodyRaw: string;
  sourceUrl?: string;
};

type MarketplaceSkillListView = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  sort: MarketplaceSkillSort;
  query?: string;
  items: MarketplaceSkillItemSummary[];
};

type MarketplaceSkillRecommendationView = {
  type: "skill";
  sceneId: string;
  title: string;
  description?: string;
  total: number;
  items: MarketplaceSkillItemSummary[];
};

export type InstalledSkillSummaryView = {
  ref: string;
  name: string;
  path: string;
  relativePath: string | null;
  scope: SkillScope;
  source: SkillScope;
  summary: string | null;
  summaryI18n: LocalizedTextMap | null;
  description: string | null;
  descriptionI18n: LocalizedTextMap | null;
  author: string | null;
  tags: string[];
  always: boolean;
};

export type InstalledSkillDetailView = InstalledSkillSummaryView & {
  metadata: Record<string, string> | null;
  raw: string;
  bodyRaw: string;
};

export type InstalledSkillsListView = {
  workspace: string;
  total: number;
  skills: InstalledSkillSummaryView[];
};

export type MarketplaceSkillsSearchView = MarketplaceSkillListView & {
  apiBaseUrl: string;
};

export type MarketplaceSkillInfoView = {
  apiBaseUrl: string;
  item: MarketplaceSkillItemView;
  content: MarketplaceSkillContentView | null;
  contentUnavailableReason: string | null;
};

export type MarketplaceSkillsRecommendationResultView = MarketplaceSkillRecommendationView & {
  apiBaseUrl: string;
};

export class SkillsQueryService {
  listInstalled = (params: {
    workdir: string;
    query?: string;
    scope?: string;
  }): InstalledSkillsListView => {
    const workspace = resolve(params.workdir);
    const loader = new SkillsLoader(workspace);
    const scope = this.normalizeInstalledScope(params.scope);
    const normalizedQuery = this.normalizeOptionalString(params.query)?.toLowerCase() ?? null;

    const skills = loader
      .listSkills(false)
      .map((skill) => this.buildInstalledSkillSummary(skill, loader, workspace))
      .filter((skill) => scope === "all" || skill.scope === scope)
      .filter((skill) => this.matchesInstalledSkillQuery(skill, normalizedQuery));

    return {
      workspace,
      total: skills.length,
      skills,
    };
  };

  getInstalledInfo = (params: {
    workdir: string;
    selector: string;
  }): InstalledSkillDetailView => {
    const workspace = resolve(params.workdir);
    const loader = new SkillsLoader(workspace);
    const skill = loader.getSkillInfo(params.selector);
    if (!skill) {
      throw new Error(`Installed skill not found: ${params.selector}`);
    }
    return this.buildInstalledSkillDetail(skill, loader, workspace);
  };

  searchMarketplaceSkills = async (params: {
    apiBaseUrl?: string;
    query?: string;
    tag?: string;
    sort?: string;
    page?: string | number;
    pageSize?: string | number;
  }): Promise<MarketplaceSkillsSearchView> => {
    const apiBaseUrl = resolveMarketplaceApiBase(params.apiBaseUrl);
    const result = await this.fetchMarketplaceView<MarketplaceSkillListView>({
      apiBaseUrl,
      path: "/api/v1/skills/items",
      query: {
        q: this.normalizeOptionalString(params.query) ?? undefined,
        tag: this.normalizeOptionalString(params.tag) ?? undefined,
        sort: this.normalizeMarketplaceSort(params.sort),
        page: this.normalizePositiveInteger(params.page),
        pageSize: this.normalizePositiveInteger(params.pageSize),
      },
    });

    return {
      apiBaseUrl,
      ...result,
      items: result.items.map((item) => this.normalizeMarketplaceSummary(item)),
    };
  };

  getMarketplaceSkillInfo = async (params: {
    apiBaseUrl?: string;
    slug: string;
  }): Promise<MarketplaceSkillInfoView> => {
    const slug = this.normalizeRequiredString(params.slug, "skill slug");
    const apiBaseUrl = resolveMarketplaceApiBase(params.apiBaseUrl);
    const encodedSlug = encodeURIComponent(slug);

    const item = await this.fetchMarketplaceView<MarketplaceSkillItemView>({
        apiBaseUrl,
        path: `/api/v1/skills/items/${encodedSlug}`,
      });

    let content: MarketplaceSkillContentView | null = null;
    let contentUnavailableReason: string | null = null;
    try {
      content = this.normalizeMarketplaceContent(await this.fetchMarketplaceView<MarketplaceSkillContentView>({
        apiBaseUrl,
        path: `/api/v1/skills/items/${encodedSlug}/content`,
      }));
    } catch (error) {
      contentUnavailableReason = error instanceof Error ? error.message : String(error);
    }

    return {
      apiBaseUrl,
      item: this.normalizeMarketplaceItem(item),
      content,
      contentUnavailableReason,
    };
  };

  recommendMarketplaceSkills = async (params: {
    apiBaseUrl?: string;
    scene?: string;
    limit?: string | number;
  }): Promise<MarketplaceSkillsRecommendationResultView> => {
    const apiBaseUrl = resolveMarketplaceApiBase(params.apiBaseUrl);
    const result = await this.fetchMarketplaceView<MarketplaceSkillRecommendationView>({
      apiBaseUrl,
      path: "/api/v1/skills/recommendations",
      query: {
        scene: this.normalizeOptionalString(params.scene) ?? undefined,
        limit: this.normalizePositiveInteger(params.limit),
      },
    });

    return {
      apiBaseUrl,
      ...result,
      items: result.items.map((item) => this.normalizeMarketplaceSummary(item)),
    };
  };

  private buildInstalledSkillSummary = (
    skill: SkillInfo,
    loader: SkillsLoader,
    workspace: string,
  ): InstalledSkillSummaryView => {
    const raw = readFileSync(skill.path, "utf8");
    const metadata = loader.getSkillMetadata(skill);
    const frontmatter = parseSkillFrontmatter(raw);

    return {
      ref: skill.ref,
      name: skill.name,
      path: skill.path,
      relativePath: this.buildRelativePath(workspace, skill.path),
      scope: skill.scope,
      source: skill.source,
      summary: frontmatter.summary ?? null,
      summaryI18n: frontmatter.summaryI18n ?? null,
      description: frontmatter.description ?? metadata?.description ?? null,
      descriptionI18n: frontmatter.descriptionI18n ?? null,
      author: frontmatter.author ?? null,
      tags: frontmatter.tags ?? [],
      always: this.readAlwaysFlag(metadata),
    };
  };

  private buildInstalledSkillDetail = (
    skill: SkillInfo,
    loader: SkillsLoader,
    workspace: string,
  ): InstalledSkillDetailView => {
    const summary = this.buildInstalledSkillSummary(skill, loader, workspace);
    const raw = readFileSync(skill.path, "utf8");
    return {
      ...summary,
      metadata: loader.getSkillMetadata(skill),
      raw,
      bodyRaw: this.stripFrontmatter(raw),
    };
  };

  private matchesInstalledSkillQuery = (
    skill: InstalledSkillSummaryView,
    query: string | null,
  ): boolean => {
    if (!query) {
      return true;
    }

    const haystacks = [
      skill.ref,
      skill.name,
      skill.path,
      skill.relativePath ?? "",
      skill.scope,
      skill.source,
      skill.summary ?? "",
      skill.description ?? "",
      skill.author ?? "",
      ...skill.tags,
      ...Object.values(skill.summaryI18n ?? {}),
      ...Object.values(skill.descriptionI18n ?? {}),
    ];

    return haystacks.some((value) => value.toLowerCase().includes(query));
  };

  private stripFrontmatter = (raw: string): string => {
    const normalized = raw.replace(/\r\n/g, "\n");
    const match = normalized.match(/^---\n[\s\S]*?\n---\n?/);
    if (!match) {
      return normalized.trim();
    }
    return normalized.slice(match[0].length).trim();
  };

  private readAlwaysFlag = (metadata: Record<string, string> | null): boolean => {
    if (metadata?.always === "true") {
      return true;
    }

    const raw = metadata?.metadata;
    if (!raw) {
      return false;
    }

    try {
      const parsed = JSON.parse(raw) as {
        nextclaw?: {
          always?: unknown;
        };
      };
      return parsed.nextclaw?.always === true;
    } catch {
      return false;
    }
  };

  private buildRelativePath = (workspace: string, absolutePath: string): string | null => {
    const relativePath = relative(workspace, absolutePath).replace(/\\/g, "/");
    return relativePath.startsWith("..") ? null : relativePath;
  };

  private normalizeMarketplaceSummary = (
    item: MarketplaceSkillItemSummary,
  ): MarketplaceSkillItemSummary => ({
    ...item,
    install: this.normalizeMarketplaceInstallSpec(item.install, item.slug),
  });

  private normalizeMarketplaceItem = (
    item: MarketplaceSkillItemView,
  ): MarketplaceSkillItemView => ({
    ...item,
    install: this.normalizeMarketplaceInstallSpec(item.install, item.slug),
  });

  private normalizeMarketplaceContent = (
    content: MarketplaceSkillContentView,
  ): MarketplaceSkillContentView => ({
    ...content,
    install: this.normalizeMarketplaceInstallSpec(content.install, content.slug),
  });

  private normalizeMarketplaceInstallSpec = (
    install: MarketplaceInstallSpec,
    slug: string,
  ): MarketplaceInstallSpec => ({
    ...install,
    command: `nextclaw marketplace skills install ${slug}`,
  });

  private normalizeInstalledScope = (value: string | undefined): InstalledSkillScopeFilter => {
    const normalized = this.normalizeOptionalString(value);
    if (!normalized || normalized === "all") {
      return "all";
    }
    if (normalized === "builtin" || normalized === "project" || normalized === "workspace") {
      return normalized;
    }
    throw new Error(`Invalid skill scope: ${value}. Expected all, builtin, project, or workspace.`);
  };

  private normalizeMarketplaceSort = (value: string | undefined): MarketplaceSkillSort | undefined => {
    const normalized = this.normalizeOptionalString(value);
    if (!normalized) {
      return undefined;
    }
    if (normalized === "relevance" || normalized === "updated") {
      return normalized;
    }
    throw new Error(`Invalid marketplace sort: ${value}. Expected relevance or updated.`);
  };

  private normalizePositiveInteger = (value: string | number | undefined): string | undefined => {
    if (value === undefined) {
      return undefined;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(`Expected a positive integer, received: ${String(value)}`);
    }
    return String(Math.floor(parsed));
  };

  private normalizeRequiredString = (value: string, label: string): string => {
    const normalized = this.normalizeOptionalString(value);
    if (!normalized) {
      throw new Error(`Missing ${label}`);
    }
    return normalized;
  };

  private normalizeOptionalString = (value: string | undefined): string | null => {
    if (typeof value !== "string") {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  private fetchMarketplaceView = async <T>(params: {
    apiBaseUrl: string;
    path: string;
    query?: Record<string, string | undefined>;
  }): Promise<T> => {
    const url = new URL(params.path, `${params.apiBaseUrl}/`);
    for (const [key, value] of Object.entries(params.query ?? {})) {
      if (typeof value === "string" && value.length > 0) {
        url.searchParams.set(key, value);
      }
    }

    const response = await runWithMarketplaceNetworkRetry(async () =>
      await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
        },
      })
    );

    const payload = await readMarketplaceEnvelope<T>(response);
    if (!payload.ok || !payload.data) {
      const message = payload.error?.message || `marketplace request failed: ${response.status}`;
      throw new Error(message);
    }

    return payload.data;
  };
}
