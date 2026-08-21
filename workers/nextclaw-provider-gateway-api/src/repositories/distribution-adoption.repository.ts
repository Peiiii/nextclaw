import type {
  DistributionAssetRecord,
  DistributionAssetRow,
  DistributionDailyRow,
  DistributionSource,
  DistributionSyncStateRow,
} from "@/types/distribution-adoption.types";

export async function upsertDistributionAssets(
  db: D1Database,
  assets: readonly DistributionAssetRecord[],
  nowIso: string,
): Promise<void> {
  if (assets.length === 0) return;
  for (const chunk of chunked(assets, 50)) {
    await db.batch(chunk.map((asset) => db.prepare(
      `INSERT INTO distribution_download_assets (
         source, asset_key, release_tag, asset_name, artifact_kind,
         platform, architecture, latest_download_count, first_observed_at, last_synced_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(source, asset_key) DO UPDATE SET
         release_tag = excluded.release_tag,
         asset_name = excluded.asset_name,
         artifact_kind = excluded.artifact_kind,
         platform = excluded.platform,
         architecture = excluded.architecture,
         latest_download_count = excluded.latest_download_count,
         last_synced_at = excluded.last_synced_at`,
    ).bind(
      asset.source,
      asset.assetKey,
      asset.releaseTag,
      asset.assetName,
      asset.artifactKind,
      asset.platform,
      asset.architecture,
      asset.downloadCount,
      nowIso,
      nowIso,
    )));
  }
}

export async function upsertDistributionDailyCounts(
  db: D1Database,
  rows: readonly {
    source: DistributionSource;
    assetKey: string;
    date: string;
    downloads: number;
  }[],
  observedAt: string,
): Promise<void> {
  if (rows.length === 0) return;
  await db.batch(rows.map((row) => db.prepare(
    `INSERT INTO distribution_download_daily (
       source, asset_key, business_date, download_count, observed_at
     ) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(source, asset_key, business_date) DO UPDATE SET
       download_count = excluded.download_count,
       observed_at = excluded.observed_at`,
  ).bind(row.source, row.assetKey, row.date, row.downloads, observedAt)));
}

export async function upsertGithubDailySnapshot(
  db: D1Database,
  assets: readonly DistributionAssetRecord[],
  businessDate: string,
  observedAt: string,
): Promise<void> {
  if (assets.length === 0) return;
  for (const chunk of chunked(assets, 50)) {
    await db.batch(chunk.map((asset) => db.prepare(
      `INSERT OR IGNORE INTO distribution_download_daily (
         source, asset_key, business_date, download_count, observed_at
       ) VALUES (?, ?, ?, ?, ?)`,
    ).bind("github_release", asset.assetKey, businessDate, asset.downloadCount, observedAt)));
  }
}

export async function recordDistributionSyncSuccess(
  db: D1Database,
  source: DistributionSource,
  nowIso: string,
): Promise<void> {
  await db.prepare(
    `INSERT INTO distribution_download_sync_state (
       source, last_attempt_at, last_success_at, last_error
     ) VALUES (?, ?, ?, NULL)
     ON CONFLICT(source) DO UPDATE SET
       last_attempt_at = excluded.last_attempt_at,
       last_success_at = excluded.last_success_at,
       last_error = NULL`,
  ).bind(source, nowIso, nowIso).run();
}

export async function recordDistributionSyncFailure(
  db: D1Database,
  source: DistributionSource,
  nowIso: string,
  error: string,
): Promise<void> {
  await db.prepare(
    `INSERT INTO distribution_download_sync_state (
       source, last_attempt_at, last_success_at, last_error
     ) VALUES (?, ?, NULL, ?)
     ON CONFLICT(source) DO UPDATE SET
       last_attempt_at = excluded.last_attempt_at,
       last_error = excluded.last_error`,
  ).bind(source, nowIso, error.slice(0, 500)).run();
}

export async function readDistributionAssets(db: D1Database): Promise<DistributionAssetRow[]> {
  const result = await db.prepare(
    `SELECT source, asset_key, release_tag, asset_name, artifact_kind,
            platform, architecture, latest_download_count, first_observed_at, last_synced_at
       FROM distribution_download_assets
      ORDER BY source ASC, release_tag DESC, artifact_kind ASC, asset_name ASC`,
  ).all<DistributionAssetRow>();
  return result.results ?? [];
}

export async function readDistributionDailyCounts(
  db: D1Database,
  source: DistributionSource,
): Promise<DistributionDailyRow[]> {
  const result = await db.prepare(
    `SELECT source, asset_key, business_date, download_count
       FROM distribution_download_daily
      WHERE source = ?
      ORDER BY business_date ASC, asset_key ASC`,
  ).bind(source).all<DistributionDailyRow>();
  return result.results ?? [];
}

export async function readDistributionSyncStates(
  db: D1Database,
): Promise<DistributionSyncStateRow[]> {
  const result = await db.prepare(
    `SELECT source, last_attempt_at, last_success_at, last_error
       FROM distribution_download_sync_state
      ORDER BY source ASC`,
  ).all<DistributionSyncStateRow>();
  return result.results ?? [];
}

function* chunked<T>(values: readonly T[], size: number): Generator<readonly T[]> {
  for (let index = 0; index < values.length; index += size) {
    yield values.slice(index, index + size);
  }
}
