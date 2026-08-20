import type {
  ProductActivityIngestRecord,
  ProductActivityMetricRow,
  ProductActivityOverviewFilter,
  ProductActivityTrendRow,
} from "@/types/product-activity.types";

export async function upsertProductActivity(
  db: D1Database,
  record: ProductActivityIngestRecord,
): Promise<void> {
  await db.batch([
    db.prepare(
      `INSERT INTO product_analytics_installations (
         installation_hash, linked_user_id, audience, environment,
         release_channel, platform, app_version, first_seen_at, last_seen_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(installation_hash) DO UPDATE SET
         linked_user_id = COALESCE(excluded.linked_user_id, product_analytics_installations.linked_user_id),
         audience = CASE
           WHEN product_analytics_installations.linked_user_id IS NOT NULL
             AND excluded.linked_user_id IS NULL
           THEN product_analytics_installations.audience
           ELSE excluded.audience
         END,
         environment = excluded.environment,
         release_channel = excluded.release_channel,
         platform = excluded.platform,
         app_version = excluded.app_version,
         last_seen_at = excluded.last_seen_at`,
    ).bind(
      record.installationHash,
      record.linkedUserId,
      record.audience,
      record.environment,
      record.releaseChannel,
      record.platform,
      record.appVersion,
      record.nowIso,
      record.nowIso,
    ),
    db.prepare(
      `INSERT INTO product_activity_daily (
         activity_date, installation_hash, intent_accepted, run_succeeded,
         direct_used, channel_used, first_seen_at, last_seen_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(activity_date, installation_hash) DO UPDATE SET
         intent_accepted = MAX(product_activity_daily.intent_accepted, excluded.intent_accepted),
         run_succeeded = MAX(product_activity_daily.run_succeeded, excluded.run_succeeded),
         direct_used = MAX(product_activity_daily.direct_used, excluded.direct_used),
         channel_used = MAX(product_activity_daily.channel_used, excluded.channel_used),
         last_seen_at = excluded.last_seen_at`,
    ).bind(
      record.activityDate,
      record.installationHash,
      record.event === "intent_accepted" ? 1 : 0,
      record.event === "run_succeeded" ? 1 : 0,
      record.source === "direct" ? 1 : 0,
      record.source === "channel" ? 1 : 0,
      record.nowIso,
      record.nowIso,
    ),
  ]);
}

export async function deleteExpiredProductActivity(
  db: D1Database,
  cutoffDate: string,
  cutoffIso: string,
): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM product_activity_daily WHERE activity_date < ?").bind(cutoffDate),
    db.prepare(
      `DELETE FROM product_analytics_installations
        WHERE last_seen_at < ?
          AND NOT EXISTS (
            SELECT 1 FROM product_activity_daily daily
             WHERE daily.installation_hash = product_analytics_installations.installation_hash
          )`,
    ).bind(cutoffIso),
  ]);
}

export async function readProductActivityMetrics(params: {
  db: D1Database;
  filter: ProductActivityOverviewFilter;
  today: string;
  wauStart: string;
  mauStart: string;
}): Promise<ProductActivityMetricRow> {
  const { db, filter, mauStart, today, wauStart } = params;
  const row = await db.prepare(
    `WITH relevant AS (
       SELECT daily.activity_date,
              daily.intent_accepted,
              daily.run_succeeded,
              installation.linked_user_id,
              CASE
                WHEN installation.linked_user_id IS NOT NULL THEN 'user:' || installation.linked_user_id
                ELSE 'install:' || installation.installation_hash
              END AS subject_key
         FROM product_activity_daily daily
         JOIN product_analytics_installations installation
           ON installation.installation_hash = daily.installation_hash
         LEFT JOIN users linked_user
           ON linked_user.id = installation.linked_user_id
        WHERE CASE
                WHEN linked_user.role = 'admin' THEN 'internal'
                WHEN linked_user.id IS NOT NULL THEN linked_user.analytics_audience
                ELSE installation.audience
              END = ?
          AND installation.environment = ?
          AND installation.release_channel = ?
          AND daily.activity_date >= ?
     )
     SELECT
       COUNT(DISTINCT CASE WHEN activity_date = ? AND intent_accepted = 1 THEN subject_key END) AS dau,
       COUNT(DISTINCT CASE WHEN activity_date >= ? AND intent_accepted = 1 THEN subject_key END) AS wau,
       COUNT(DISTINCT CASE WHEN intent_accepted = 1 THEN subject_key END) AS mau,
       COUNT(DISTINCT CASE WHEN activity_date = ? AND run_succeeded = 1 THEN subject_key END) AS successful_dau,
       COUNT(DISTINCT CASE WHEN activity_date >= ? AND run_succeeded = 1 THEN subject_key END) AS successful_wau,
       COUNT(DISTINCT CASE WHEN run_succeeded = 1 THEN subject_key END) AS successful_mau,
       COUNT(DISTINCT CASE
         WHEN activity_date >= ? AND intent_accepted = 1 AND linked_user_id IS NULL THEN subject_key
       END) AS wau_anonymous_installations,
       COUNT(DISTINCT CASE
         WHEN activity_date >= ? AND intent_accepted = 1 AND linked_user_id IS NOT NULL THEN subject_key
       END) AS wau_identified_users
     FROM relevant`,
  ).bind(
    filter.audience,
    filter.environment,
    filter.releaseChannel,
    mauStart,
    today,
    wauStart,
    today,
    wauStart,
    wauStart,
    wauStart,
  ).first<ProductActivityMetricRow>();

  return row ?? {
    dau: 0,
    wau: 0,
    mau: 0,
    successful_dau: 0,
    successful_wau: 0,
    successful_mau: 0,
    wau_anonymous_installations: 0,
    wau_identified_users: 0,
  };
}

export async function readProductActivityTrend(params: {
  db: D1Database;
  filter: ProductActivityOverviewFilter;
  startDate: string;
}): Promise<ProductActivityTrendRow[]> {
  const { db, filter, startDate } = params;
  const result = await db.prepare(
    `SELECT daily.activity_date,
            COUNT(DISTINCT CASE
              WHEN daily.intent_accepted = 1 THEN
                CASE
                  WHEN installation.linked_user_id IS NOT NULL THEN 'user:' || installation.linked_user_id
                  ELSE 'install:' || installation.installation_hash
                END
            END) AS active,
            COUNT(DISTINCT CASE
              WHEN daily.run_succeeded = 1 THEN
                CASE
                  WHEN installation.linked_user_id IS NOT NULL THEN 'user:' || installation.linked_user_id
                  ELSE 'install:' || installation.installation_hash
                END
            END) AS successful
       FROM product_activity_daily daily
       JOIN product_analytics_installations installation
         ON installation.installation_hash = daily.installation_hash
       LEFT JOIN users linked_user
         ON linked_user.id = installation.linked_user_id
      WHERE CASE
              WHEN linked_user.role = 'admin' THEN 'internal'
              WHEN linked_user.id IS NOT NULL THEN linked_user.analytics_audience
              ELSE installation.audience
            END = ?
        AND installation.environment = ?
        AND installation.release_channel = ?
        AND daily.activity_date >= ?
      GROUP BY daily.activity_date
      ORDER BY daily.activity_date ASC`,
  ).bind(
    filter.audience,
    filter.environment,
    filter.releaseChannel,
    startDate,
  ).all<ProductActivityTrendRow>();
  return result.results ?? [];
}
