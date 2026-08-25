import type {
  ProductActivityIngestRecord,
  ProductActivityMetricRow,
  ProductActivityOverviewFilter,
  ProductActivityTrendRow,
} from "@/types/product-activity.types";

export async function insertProductActivityReceipt(
  db: D1Database,
  record: ProductActivityIngestRecord,
): Promise<void> {
  await db.prepare(
    `INSERT OR IGNORE INTO anonymous_product_activity_receipts (
       receipt_id, metric, period_kind, period_start, audience, environment,
       release_channel, platform, app_version, received_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    record.receiptId,
    record.metric,
    record.periodKind,
    record.periodStart,
    record.audience,
    record.environment,
    record.releaseChannel,
    record.platform,
    record.appVersion,
    record.receivedAt,
  ).run();
}

export async function deleteExpiredProductActivity(
  db: D1Database,
  cutoffIso: string,
): Promise<void> {
  await db.prepare(
    "DELETE FROM anonymous_product_activity_receipts WHERE received_at < ?",
  ).bind(cutoffIso).run();
}

export async function readProductActivityMetrics(params: {
  db: D1Database;
  filter: ProductActivityOverviewFilter;
  dayStart: string;
  weekStart: string;
  monthStart: string;
}): Promise<ProductActivityMetricRow> {
  const { db, dayStart, filter, monthStart, weekStart } = params;
  const row = await db.prepare(
    `SELECT
       COUNT(CASE WHEN period_kind = 'day' AND period_start = ? AND metric = 'active' THEN 1 END) AS dau,
       COUNT(CASE WHEN period_kind = 'week' AND period_start = ? AND metric = 'active' THEN 1 END) AS wau,
       COUNT(CASE WHEN period_kind = 'month' AND period_start = ? AND metric = 'active' THEN 1 END) AS mau,
       COUNT(CASE WHEN period_kind = 'day' AND period_start = ? AND metric = 'successful' THEN 1 END) AS successful_dau,
       COUNT(CASE WHEN period_kind = 'week' AND period_start = ? AND metric = 'successful' THEN 1 END) AS successful_wau,
       COUNT(CASE WHEN period_kind = 'month' AND period_start = ? AND metric = 'successful' THEN 1 END) AS successful_mau
     FROM anonymous_product_activity_receipts
     WHERE audience = ?
       AND environment = ?
       AND release_channel = ?`,
  ).bind(
    dayStart,
    weekStart,
    monthStart,
    dayStart,
    weekStart,
    monthStart,
    filter.audience,
    filter.environment,
    filter.releaseChannel,
  ).first<ProductActivityMetricRow>();

  return row ?? {
    dau: 0,
    wau: 0,
    mau: 0,
    successful_dau: 0,
    successful_wau: 0,
    successful_mau: 0,
  };
}

export async function readProductActivityTrend(params: {
  db: D1Database;
  filter: ProductActivityOverviewFilter;
  startDate: string;
}): Promise<ProductActivityTrendRow[]> {
  const { db, filter, startDate } = params;
  const result = await db.prepare(
    `SELECT period_start AS activity_date,
            COUNT(CASE WHEN metric = 'active' THEN 1 END) AS active,
            COUNT(CASE WHEN metric = 'successful' THEN 1 END) AS successful
       FROM anonymous_product_activity_receipts
      WHERE audience = ?
        AND environment = ?
        AND release_channel = ?
        AND period_kind = 'day'
        AND period_start >= ?
      GROUP BY period_start
      ORDER BY period_start ASC`,
  ).bind(
    filter.audience,
    filter.environment,
    filter.releaseChannel,
    startDate,
  ).all<ProductActivityTrendRow>();
  return result.results ?? [];
}
