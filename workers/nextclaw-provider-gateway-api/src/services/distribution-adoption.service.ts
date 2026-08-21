import {
  readDistributionAssets,
  readDistributionDailyCounts,
  readDistributionSyncStates,
  recordDistributionSyncFailure,
  recordDistributionSyncSuccess,
  upsertDistributionAssets,
  upsertDistributionDailyCounts,
  upsertGithubDailySnapshot,
} from "@/repositories/distribution-adoption.repository";
import type {
  DistributionAdoptionOverview,
  DistributionArtifactKind,
  DistributionAssetListQuery,
  DistributionAssetRecord,
  DistributionAssetRow,
  DistributionDailyRow,
} from "@/types/distribution-adoption.types";
import type { Env } from "@/types/platform";

const GITHUB_RELEASES_URL = "https://api.github.com/repos/Peiiii/nextclaw/releases?per_page=100";
const NPM_DOWNLOADS_URL = "https://api.npmjs.org/downloads/range/last-month/nextclaw";
const TIMEZONE = "Asia/Shanghai" as const;
const MANUAL_REFRESH_COOLDOWN_MS = 5 * 60 * 1_000;
const DEFAULT_ASSET_LIST_QUERY: DistributionAssetListQuery = {
  page: 1,
  pageSize: 10,
  query: "",
  artifactKind: null,
  platform: null,
  sortBy: "default",
  sortDirection: "desc",
};

type GitHubRelease = {
  tag_name?: unknown;
  assets?: unknown;
};

type GitHubReleaseAsset = {
  id?: unknown;
  name?: unknown;
  download_count?: unknown;
};

type NpmDailyDownload = {
  day?: unknown;
  downloads?: unknown;
};

export type DistributionSyncResult = {
  github: "success" | "failed" | "cached";
  npm: "success" | "failed" | "cached";
};

export class DistributionAdoptionService {
  constructor(
    private readonly env: Env,
    private readonly now: () => Date = () => new Date(),
    // Cloudflare's fetch is an illegal invocation when detached from globalThis.
    // Keep the default as a closure while preserving an injectable client for tests.
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  sync = async (options: { snapshotPreviousDay: boolean; force?: boolean }): Promise<DistributionSyncResult> => {
    const now = this.now();
    const nowIso = now.toISOString();
    const states = await readDistributionSyncStates(this.env.NEXTCLAW_PLATFORM_DB);
    const statesBySource = new Map(states.map((state) => [state.source, state]));
    const [github, npm] = await Promise.all([
      this.syncGithub(
        nowIso,
        options.snapshotPreviousDay ? previousBusinessDate(now) : null,
        options.force !== true && isWithinManualCooldown(statesBySource.get("github_release")?.last_success_at, now),
      ),
      this.syncNpm(
        nowIso,
        options.force !== true && isWithinManualCooldown(statesBySource.get("npm_registry")?.last_success_at, now),
      ),
    ]);
    return { github, npm };
  };

  readOverview = async (
    assetListQuery: DistributionAssetListQuery = DEFAULT_ASSET_LIST_QUERY,
  ): Promise<DistributionAdoptionOverview> => {
    const [assets, githubDaily, npmDaily, syncStates] = await Promise.all([
      readDistributionAssets(this.env.NEXTCLAW_PLATFORM_DB),
      readDistributionDailyCounts(this.env.NEXTCLAW_PLATFORM_DB, "github_release"),
      readDistributionDailyCounts(this.env.NEXTCLAW_PLATFORM_DB, "npm_registry"),
      readDistributionSyncStates(this.env.NEXTCLAW_PLATFORM_DB),
    ]);
    const now = this.now();
    const today = businessDate(now);
    const yesterday = previousBusinessDate(now);
    const twoDaysAgo = businessDate(addBusinessDays(now, -2));
    const githubCurrent = assets.filter((asset) => asset.source === "github_release");
    const githubByDate = sumGithubDailyByDate(githubDaily);
    const npmTrend = npmDaily
      .filter((entry) => entry.asset_key === "nextclaw")
      .map((entry) => ({ date: entry.business_date, downloads: entry.download_count }));
    const sourceStates = new Map(syncStates.map((state) => [state.source, state]));
    const githubState = sourceStates.get("github_release");
    const npmState = sourceStates.get("npm_registry");
    const latestNpm = npmTrend.at(-1) ?? null;
    const firstGithubSnapshotDate = githubDaily.length > 0 ? githubDaily[0]?.business_date ?? null : null;

    return {
      timezone: TIMEZONE,
      fetchedAt: latestTimestamp(githubState?.last_success_at, npmState?.last_success_at),
      github: {
        totalDownloads: githubCurrent.reduce((total, asset) => total + normalizeCount(asset.latest_download_count), 0),
        todayDownloads: githubTodayDownloads(githubCurrent, githubByDate.get(today), githubByDate.get(yesterday)),
        yesterdayDownloads: githubDelta(githubByDate.get(yesterday), githubByDate.get(twoDaysAgo)),
        firstDailySnapshotDate: firstGithubSnapshotDate,
      },
      npm: {
        latestDate: latestNpm?.date ?? null,
        latestDownloads: latestNpm?.downloads ?? null,
        trend: npmTrend,
      },
      sources: (["github_release", "npm_registry"] as const).map((source) => {
        const state = sourceStates.get(source);
        return {
          source,
          lastAttemptAt: state?.last_attempt_at ?? null,
          lastSuccessAt: state?.last_success_at ?? null,
          lastError: state?.last_error ?? null,
        };
      }),
      assets: toAssetList(githubCurrent, githubDaily, today, yesterday, twoDaysAgo, assetListQuery),
    };
  };

  private syncGithub = async (
    nowIso: string,
    snapshotDate: string | null,
    useCachedValue: boolean,
  ): Promise<"success" | "failed" | "cached"> => {
    if (useCachedValue) return "cached";
    try {
      const assets = await this.fetchGithubReleaseAssets();
      await upsertDistributionAssets(this.env.NEXTCLAW_PLATFORM_DB, assets, nowIso);
      if (snapshotDate) {
        await upsertGithubDailySnapshot(this.env.NEXTCLAW_PLATFORM_DB, assets, snapshotDate, nowIso);
      }
      await recordDistributionSyncSuccess(this.env.NEXTCLAW_PLATFORM_DB, "github_release", nowIso);
      return "success";
    } catch (error) {
      await recordDistributionSyncFailure(
        this.env.NEXTCLAW_PLATFORM_DB,
        "github_release",
        nowIso,
        errorMessage(error),
      );
      return "failed";
    }
  };

  private syncNpm = async (
    nowIso: string,
    useCachedValue: boolean,
  ): Promise<"success" | "failed" | "cached"> => {
    if (useCachedValue) return "cached";
    try {
      const response = await this.fetchImpl(NPM_DOWNLOADS_URL);
      if (!response.ok) throw new Error(`npm downloads request failed: ${response.status}`);
      const payload = await response.json();
      const trend = parseNpmDailyDownloads(payload);
      await upsertDistributionAssets(this.env.NEXTCLAW_PLATFORM_DB, [{
        source: "npm_registry",
        assetKey: "nextclaw",
        releaseTag: null,
        assetName: "nextclaw",
        artifactKind: "npm_package",
        platform: null,
        architecture: null,
        downloadCount: trend.at(-1)?.downloads ?? 0,
      }], nowIso);
      await upsertDistributionDailyCounts(
        this.env.NEXTCLAW_PLATFORM_DB,
        trend.map((entry) => ({
          source: "npm_registry" as const,
          assetKey: "nextclaw",
          date: entry.date,
          downloads: entry.downloads,
        })),
        nowIso,
      );
      await recordDistributionSyncSuccess(this.env.NEXTCLAW_PLATFORM_DB, "npm_registry", nowIso);
      return "success";
    } catch (error) {
      await recordDistributionSyncFailure(
        this.env.NEXTCLAW_PLATFORM_DB,
        "npm_registry",
        nowIso,
        errorMessage(error),
      );
      return "failed";
    }
  };

  private fetchGithubReleaseAssets = async (): Promise<DistributionAssetRecord[]> => {
    const releases: unknown[] = [];
    let url: string | null = GITHUB_RELEASES_URL;
    while (url) {
      const response = await this.fetchImpl(url, {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "NextClaw-Distribution-Adoption-Dashboard",
        },
      });
      if (!response.ok) throw new Error(`GitHub release request failed: ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload)) throw new Error("GitHub releases payload must be an array.");
      releases.push(...payload);
      url = nextGithubPage(response.headers.get("link"));
    }
    return parseGithubReleaseAssets(releases);
  };
}

export function parseGithubReleaseAssets(value: unknown): DistributionAssetRecord[] {
  if (!Array.isArray(value)) throw new Error("GitHub releases payload must be an array.");
  const assets: DistributionAssetRecord[] = [];
  for (const release of value as GitHubRelease[]) {
    if (typeof release.tag_name !== "string" || !Array.isArray(release.assets)) continue;
    for (const asset of release.assets as GitHubReleaseAsset[]) {
      if (
        typeof asset.id !== "number"
        || typeof asset.name !== "string"
        || typeof asset.download_count !== "number"
        || asset.download_count < 0
      ) continue;
      assets.push({
        source: "github_release",
        assetKey: String(asset.id),
        releaseTag: release.tag_name,
        assetName: asset.name,
        artifactKind: classifyArtifact(release.tag_name, asset.name),
        platform: resolvePlatform(asset.name),
        architecture: resolveArchitecture(asset.name),
        downloadCount: Math.floor(asset.download_count),
      });
    }
  }
  return assets;
}

export function parseNpmDailyDownloads(value: unknown): Array<{ date: string; downloads: number }> {
  if (!isRecord(value) || !Array.isArray(value.downloads)) {
    throw new Error("npm downloads payload is invalid.");
  }
  return (value.downloads as NpmDailyDownload[])
    .flatMap((entry) => (
      typeof entry.day === "string"
      && /^\d{4}-\d{2}-\d{2}$/.test(entry.day)
      && typeof entry.downloads === "number"
      && entry.downloads >= 0
        ? [{ date: entry.day, downloads: Math.floor(entry.downloads) }]
        : []
    ))
    .sort((left, right) => left.date.localeCompare(right.date));
}

export function shouldSnapshotPreviousDay(date: Date): boolean {
  const hour = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date));
  return hour === 0;
}

function classifyArtifact(releaseTag: string, assetName: string): DistributionArtifactKind {
  const normalized = assetName.toLowerCase();
  if (releaseTag.startsWith("nextclaw@") && normalized.startsWith("nextclaw-runtime-")) {
    return "npm_runtime_bundle";
  }
  if (!releaseTag.includes("desktop")) return "other";
  if (normalized.startsWith("nextclaw-bundle-")) return "desktop_runtime_bundle";
  if (normalized.includes("portable") || normalized.includes("unpacked")) return "desktop_portable";
  if (normalized.endsWith(".dmg") || normalized.endsWith(".exe") || normalized.endsWith(".deb") || normalized.endsWith(".appimage")) {
    return "desktop_installer";
  }
  if (normalized.includes("manifest") || normalized.includes("latest") || normalized.endsWith(".blockmap") || normalized.endsWith(".pem")) {
    return "update_metadata";
  }
  return "other";
}

function resolvePlatform(assetName: string): string | null {
  const normalized = assetName.toLowerCase();
  if (normalized.includes("darwin") || normalized.includes("mac")) return "macOS";
  if (normalized.includes("win32") || normalized.includes("win-")) return "Windows";
  if (normalized.includes("linux") || normalized.endsWith(".deb")) return "Linux";
  return null;
}

function resolveArchitecture(assetName: string): string | null {
  const normalized = assetName.toLowerCase();
  if (normalized.includes("arm64")) return "ARM64";
  if (normalized.includes("x64") || normalized.includes("amd64")) return "x64";
  return null;
}

function toOverviewAsset(
  asset: DistributionAssetRow,
  daily: readonly DistributionDailyRow[],
  today: string,
  yesterday: string,
  twoDaysAgo: string,
): DistributionAdoptionOverview["assets"]["items"][number] {
  const counts = new Map(daily
    .filter((entry) => entry.asset_key === asset.asset_key)
    .map((entry) => [entry.business_date, entry.download_count]));
  return {
    source: asset.source,
    assetKey: asset.asset_key,
    releaseTag: asset.release_tag,
    assetName: asset.asset_name,
    artifactKind: asset.artifact_kind,
    platform: asset.platform,
    architecture: asset.architecture,
    downloadCount: normalizeCount(asset.latest_download_count),
    firstObservedAt: asset.first_observed_at,
    lastSyncedAt: asset.last_synced_at,
    todayDownloads: githubTodayDownloads([asset], counts.get(today), counts.get(yesterday)),
    yesterdayDownloads: githubDelta(counts.get(yesterday), counts.get(twoDaysAgo)),
  };
}

function toAssetList(
  assets: readonly DistributionAssetRow[],
  daily: readonly DistributionDailyRow[],
  today: string,
  yesterday: string,
  twoDaysAgo: string,
  query: DistributionAssetListQuery,
): DistributionAdoptionOverview["assets"] {
  const overviewAssets = assets.map((asset) => toOverviewAsset(asset, daily, today, yesterday, twoDaysAgo));
  const selection = selectDistributionOverviewAssets(overviewAssets, query);
  return {
    items: selection.items,
    page: selection.page,
    pageSize: query.pageSize,
    total: selection.total,
    totalPages: selection.totalPages,
    artifactKinds: Array.from(new Set(assets.map((asset) => asset.artifact_kind))).sort(),
    platforms: Array.from(new Set(assets.flatMap((asset) => asset.platform ? [asset.platform] : []))).sort(),
  };
}

export function selectDistributionOverviewAssets(
  assets: readonly DistributionAdoptionOverview["assets"]["items"][number][],
  query: DistributionAssetListQuery,
): {
  items: DistributionAdoptionOverview["assets"]["items"];
  page: number;
  total: number;
  totalPages: number;
} {
  const normalizedQuery = query.query.trim().toLocaleLowerCase();
  const filtered = assets.filter((asset) => {
    if (query.artifactKind && asset.artifactKind !== query.artifactKind) return false;
    if (query.platform && asset.platform !== query.platform) return false;
    if (!normalizedQuery) return true;
    return [asset.assetName, asset.releaseTag]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
  });
  const sorted = query.sortBy === "default"
    ? filtered
    : [...filtered].sort((left, right) => compareOverviewAssets(left, right, query));
  const total = sorted.length;
  const totalPages = Math.ceil(total / query.pageSize);
  const page = totalPages === 0 ? 1 : Math.min(query.page, totalPages);
  const start = (page - 1) * query.pageSize;
  return { items: sorted.slice(start, start + query.pageSize), page, total, totalPages };
}

function compareOverviewAssets(
  left: DistributionAdoptionOverview["assets"]["items"][number],
  right: DistributionAdoptionOverview["assets"]["items"][number],
  query: DistributionAssetListQuery,
): number {
  const sortBy = query.sortBy as Exclude<DistributionAssetListQuery["sortBy"], "default">;
  const leftValue = sortableAssetValue(left, sortBy);
  const rightValue = sortableAssetValue(right, sortBy);
  if (leftValue === null) return rightValue === null ? left.assetName.localeCompare(right.assetName) : 1;
  if (rightValue === null) return -1;
  const comparison = typeof leftValue === "number" && typeof rightValue === "number"
    ? leftValue - rightValue
    : String(leftValue).localeCompare(String(rightValue));
  if (comparison === 0) return left.assetName.localeCompare(right.assetName);
  return query.sortDirection === "asc" ? comparison : -comparison;
}

function sortableAssetValue(
  asset: DistributionAdoptionOverview["assets"]["items"][number],
  sortBy: Exclude<DistributionAssetListQuery["sortBy"], "default">,
): number | string | null {
  return {
    asset_name: asset.assetName,
    artifact_kind: asset.artifactKind,
    platform: asset.platform,
    download_count: asset.downloadCount,
    today_downloads: asset.todayDownloads,
    yesterday_downloads: asset.yesterdayDownloads,
  }[sortBy];
}

function sumGithubDailyByDate(entries: readonly DistributionDailyRow[]): Map<string, number> {
  const sums = new Map<string, number>();
  for (const entry of entries) {
    sums.set(entry.business_date, (sums.get(entry.business_date) ?? 0) + normalizeCount(entry.download_count));
  }
  return sums;
}

function githubTodayDownloads(
  assets: readonly Pick<DistributionAssetRow, "latest_download_count">[],
  todaySnapshot: number | undefined,
  yesterdaySnapshot: number | undefined,
): number | null {
  const baseline = todaySnapshot ?? yesterdaySnapshot;
  if (baseline === undefined) return null;
  const current = assets.reduce((total, asset) => total + normalizeCount(asset.latest_download_count), 0);
  return Math.max(0, current - baseline);
}

function githubDelta(current: number | undefined, previous: number | undefined): number | null {
  if (current === undefined || previous === undefined) return null;
  return Math.max(0, current - previous);
}

function businessDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function previousBusinessDate(date: Date): string {
  return businessDate(addBusinessDays(date, -1));
}

function addBusinessDays(date: Date, days: number): Date {
  const value = new Date(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value;
}

function latestTimestamp(...values: Array<string | null | undefined>): string | null {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
}

function nextGithubPage(link: string | null): string | null {
  if (!link) return null;
  const match = /<([^>]+)>;\s*rel="next"/.exec(link);
  return match?.[1] ?? null;
}

function isWithinManualCooldown(lastSuccessAt: string | null | undefined, now: Date): boolean {
  if (!lastSuccessAt) return false;
  const timestamp = new Date(lastSuccessAt).getTime();
  return Number.isFinite(timestamp) && now.getTime() - timestamp < MANUAL_REFRESH_COOLDOWN_MS;
}

function normalizeCount(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
