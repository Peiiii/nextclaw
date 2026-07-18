import type {
  RemoteInstanceRow,
  RemoteInstanceView,
} from "@/types/platform";
import type { RemoteInstanceListQuery } from "@/types/remote-instance.types";

export async function getRemoteInstanceByInstallId(db: D1Database, instanceInstallId: string): Promise<RemoteInstanceRow | null> {
  const row = await db.prepare(
    `SELECT id, user_id, device_install_id AS instance_install_id, display_name, platform, app_version,
            local_origin, status, last_seen_at, archived_at, created_at, updated_at
       FROM remote_devices
      WHERE device_install_id = ?`
  )
    .bind(instanceInstallId)
    .first<RemoteInstanceRow>();
  return row ?? null;
}

export async function getRemoteInstanceById(db: D1Database, instanceId: string): Promise<RemoteInstanceRow | null> {
  const row = await db.prepare(
    `SELECT id, user_id, device_install_id AS instance_install_id, display_name, platform, app_version,
            local_origin, status, last_seen_at, archived_at, created_at, updated_at
       FROM remote_devices
      WHERE id = ?`
  )
    .bind(instanceId)
    .first<RemoteInstanceRow>();
  return row ?? null;
}

export async function listRemoteInstancesByUserId(
  db: D1Database,
  userId: string,
  query: RemoteInstanceListQuery
): Promise<{ rows: RemoteInstanceRow[]; total: number }> {
  const conditions = ["user_id = ?"];
  const bindings: Array<string | number> = [userId];

  if (query.archiveStatus === "active") {
    conditions.push("archived_at IS NULL");
  } else if (query.archiveStatus === "archived") {
    conditions.push("archived_at IS NOT NULL");
  }

  if (query.connectionStatus !== "all") {
    conditions.push("status = ?");
    bindings.push(query.connectionStatus);
  }

  if (query.q) {
    const searchPattern = `%${query.q.replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(`(
      display_name LIKE ? ESCAPE '\\'
      OR id LIKE ? ESCAPE '\\'
      OR device_install_id LIKE ? ESCAPE '\\'
      OR platform LIKE ? ESCAPE '\\'
      OR app_version LIKE ? ESCAPE '\\'
    )`);
    bindings.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
  }

  const whereSql = conditions.join("\n        AND ");
  const count = await db.prepare(
    `SELECT COUNT(*) AS total
       FROM remote_devices
      WHERE ${whereSql}`
  )
    .bind(...bindings)
    .first<{ total: number }>();
  const orderColumn = {
    lastSeenAt: "last_seen_at",
    displayName: "display_name COLLATE NOCASE",
    createdAt: "created_at",
  }[query.sortBy];
  const orderDirection = query.sortDirection === "asc" ? "ASC" : "DESC";
  const offset = (query.page - 1) * query.pageSize;
  const rows = await db.prepare(
    `SELECT id, user_id, device_install_id AS instance_install_id, display_name, platform, app_version,
            local_origin, status, last_seen_at, archived_at, created_at, updated_at
       FROM remote_devices
      WHERE ${whereSql}
      ORDER BY ${orderColumn} ${orderDirection}, id ${orderDirection}
      LIMIT ? OFFSET ?`
  )
    .bind(...bindings, query.pageSize, offset)
    .all<RemoteInstanceRow>();
  return { rows: rows.results ?? [], total: Number(count?.total ?? 0) };
}

export async function upsertRemoteInstance(
  db: D1Database,
  payload: {
    id: string;
    userId: string;
    instanceInstallId: string;
    displayName: string;
    platform: string;
    appVersion: string;
    localOrigin: string;
    status: "online" | "offline";
    lastSeenAt: string;
  }
): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO remote_devices (
      id, user_id, device_install_id, display_name, platform, app_version,
      local_origin, status, last_seen_at, archived_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
    ON CONFLICT(device_install_id) DO UPDATE SET
      user_id = excluded.user_id,
      display_name = excluded.display_name,
      platform = excluded.platform,
      app_version = excluded.app_version,
      local_origin = excluded.local_origin,
      status = excluded.status,
      last_seen_at = excluded.last_seen_at,
      archived_at = NULL,
      updated_at = excluded.updated_at`
  )
    .bind(
      payload.id,
      payload.userId,
      payload.instanceInstallId,
      payload.displayName,
      payload.platform,
      payload.appVersion,
      payload.localOrigin,
      payload.status,
      payload.lastSeenAt,
      now,
      now
    )
    .run();
}

export async function touchRemoteInstance(
  db: D1Database,
  instanceId: string,
  payload: { status: "online" | "offline"; lastSeenAt: string }
): Promise<void> {
  await db.prepare(
    `UPDATE remote_devices
        SET status = ?,
            last_seen_at = ?,
            updated_at = ?
      WHERE id = ?`
  )
    .bind(payload.status, payload.lastSeenAt, payload.lastSeenAt, instanceId)
    .run();
}

export async function archiveRemoteInstance(db: D1Database, instanceId: string, archivedAt: string): Promise<void> {
  await db.prepare(
    `UPDATE remote_devices
        SET archived_at = ?,
            updated_at = ?
      WHERE id = ?`
  )
    .bind(archivedAt, archivedAt, instanceId)
    .run();
}

export async function unarchiveRemoteInstance(db: D1Database, instanceId: string, updatedAt: string): Promise<void> {
  await db.prepare(
    `UPDATE remote_devices
        SET archived_at = NULL,
            updated_at = ?
      WHERE id = ?`
  )
    .bind(updatedAt, instanceId)
    .run();
}

export async function deleteRemoteAccessSessionsByInstanceId(db: D1Database, instanceId: string): Promise<void> {
  await db.prepare("DELETE FROM remote_sessions WHERE device_id = ?").bind(instanceId).run();
}

export async function deleteRemoteShareGrantsByInstanceId(db: D1Database, instanceId: string): Promise<void> {
  await db.prepare("DELETE FROM remote_share_grants WHERE device_id = ?").bind(instanceId).run();
}

export async function deleteRemoteInstanceById(db: D1Database, instanceId: string): Promise<void> {
  await db.prepare("DELETE FROM remote_devices WHERE id = ?").bind(instanceId).run();
}

export function toRemoteInstanceView(row: RemoteInstanceRow): RemoteInstanceView {
  return {
    id: row.id,
    instanceInstallId: row.instance_install_id,
    displayName: row.display_name,
    platform: row.platform,
    appVersion: row.app_version,
    localOrigin: row.local_origin,
    status: row.status,
    lastSeenAt: row.last_seen_at,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
