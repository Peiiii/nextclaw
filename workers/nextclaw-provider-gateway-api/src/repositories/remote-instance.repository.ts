import type {
  RemoteInstanceListQuery,
  RemoteInstanceRow,
  RemoteInstanceView,
} from "@/types/platform";

const REMOTE_INSTANCE_SELECT = `
  SELECT devices.id,
         devices.user_id,
         devices.device_install_id AS instance_install_id,
         devices.display_name,
         devices.platform,
         devices.app_version,
         devices.local_origin,
         system_domain.prefix AS system_domain_prefix,
         system_domain.claimed_at AS system_domain_claimed_at,
         custom_domain.prefix AS custom_domain_prefix,
         custom_domain.claimed_at AS custom_domain_claimed_at,
         custom_domain.expires_at AS custom_domain_expires_at,
         devices.status,
         devices.last_seen_at,
         devices.archived_at,
         devices.created_at,
         devices.updated_at
    FROM remote_devices devices
    JOIN remote_instance_domains system_domain
      ON system_domain.instance_id = devices.id
     AND system_domain.kind = 'system'
    LEFT JOIN remote_instance_domains custom_domain
      ON custom_domain.instance_id = devices.id
     AND custom_domain.kind = 'custom'`;

export async function getRemoteInstanceByInstallId(
  db: D1Database,
  instanceInstallId: string,
): Promise<RemoteInstanceRow | null> {
  const row = await db
    .prepare(
      `${REMOTE_INSTANCE_SELECT}
      WHERE devices.device_install_id = ?`,
    )
    .bind(instanceInstallId)
    .first<RemoteInstanceRow>();
  return row ?? null;
}

export async function getRemoteInstanceById(
  db: D1Database,
  instanceId: string,
): Promise<RemoteInstanceRow | null> {
  const row = await db
    .prepare(
      `${REMOTE_INSTANCE_SELECT}
      WHERE devices.id = ?`,
    )
    .bind(instanceId)
    .first<RemoteInstanceRow>();
  return row ?? null;
}

export async function getRemoteInstanceByDomainPrefix(
  db: D1Database,
  domainPrefix: string,
): Promise<RemoteInstanceRow | null> {
  const row = await db
    .prepare(
      `${REMOTE_INSTANCE_SELECT}
      WHERE devices.id = (
        SELECT instance_id
          FROM remote_instance_domains
         WHERE prefix = ?
      )`,
    )
    .bind(domainPrefix)
    .first<RemoteInstanceRow>();
  return row ?? null;
}

export async function listRemoteInstancesByUserId(
  db: D1Database,
  userId: string,
  query: RemoteInstanceListQuery,
): Promise<{ rows: RemoteInstanceRow[]; total: number }> {
  const conditions = ["devices.user_id = ?"];
  const bindings: Array<string | number> = [userId];

  if (query.archiveStatus === "active") {
    conditions.push("devices.archived_at IS NULL");
  } else if (query.archiveStatus === "archived") {
    conditions.push("devices.archived_at IS NOT NULL");
  }

  if (query.connectionStatus !== "all") {
    conditions.push("devices.status = ?");
    bindings.push(query.connectionStatus);
  }

  if (query.q) {
    const searchPattern = `%${query.q.replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(`(
      devices.display_name LIKE ? ESCAPE '\\'
      OR devices.id LIKE ? ESCAPE '\\'
      OR devices.device_install_id LIKE ? ESCAPE '\\'
      OR devices.platform LIKE ? ESCAPE '\\'
      OR devices.app_version LIKE ? ESCAPE '\\'
      OR devices.local_origin LIKE ? ESCAPE '\\'
      OR EXISTS (
        SELECT 1
          FROM remote_instance_domains domain_search
         WHERE domain_search.instance_id = devices.id
           AND domain_search.prefix LIKE ? ESCAPE '\\'
      )
    )`);
    bindings.push(
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
    );
  }

  const whereSql = conditions.join("\n        AND ");
  const count = await db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM remote_devices devices
      WHERE ${whereSql}`,
    )
    .bind(...bindings)
    .first<{ total: number }>();
  const orderColumn = {
    lastSeenAt: "devices.last_seen_at",
    displayName: "devices.display_name COLLATE NOCASE",
    createdAt: "devices.created_at",
  }[query.sortBy];
  const orderDirection = query.sortDirection === "asc" ? "ASC" : "DESC";
  const offset = (query.page - 1) * query.pageSize;
  const rows = await db
    .prepare(
      `${REMOTE_INSTANCE_SELECT}
      WHERE ${whereSql}
      ORDER BY ${orderColumn} ${orderDirection}, devices.id ${orderDirection}
      LIMIT ? OFFSET ?`,
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
  },
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO remote_devices (
      id, user_id, device_install_id, display_name, platform, app_version,
      local_origin, status, last_seen_at, archived_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
    ON CONFLICT(device_install_id) DO UPDATE SET
      display_name = excluded.display_name,
      platform = excluded.platform,
      app_version = excluded.app_version,
      local_origin = excluded.local_origin,
      status = excluded.status,
      last_seen_at = excluded.last_seen_at,
      archived_at = NULL,
      updated_at = excluded.updated_at
    WHERE remote_devices.user_id = excluded.user_id`,
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
      now,
    )
    .run();
}

export async function migrateRemoteInstanceInstallId(
  db: D1Database,
  payload: {
    instanceId: string;
    legacyInstallId: string;
    instanceInstallId: string;
    updatedAt: string;
  },
): Promise<void> {
  await db
    .prepare(
      `UPDATE remote_devices
        SET device_install_id = ?,
            updated_at = ?
      WHERE id = ?
        AND device_install_id = ?`,
    )
    .bind(
      payload.instanceInstallId,
      payload.updatedAt,
      payload.instanceId,
      payload.legacyInstallId,
    )
    .run();
}

export async function touchRemoteInstance(
  db: D1Database,
  instanceId: string,
  payload: { status: "online" | "offline"; lastSeenAt: string },
): Promise<void> {
  await db
    .prepare(
      `UPDATE remote_devices
        SET status = ?,
            last_seen_at = ?,
            updated_at = ?
      WHERE id = ?`,
    )
    .bind(payload.status, payload.lastSeenAt, payload.lastSeenAt, instanceId)
    .run();
}

export async function archiveRemoteInstance(
  db: D1Database,
  instanceId: string,
  archivedAt: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE remote_devices
        SET archived_at = ?,
            updated_at = ?
      WHERE id = ?`,
    )
    .bind(archivedAt, archivedAt, instanceId)
    .run();
}

export async function unarchiveRemoteInstance(
  db: D1Database,
  instanceId: string,
  updatedAt: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE remote_devices
        SET archived_at = NULL,
            updated_at = ?
      WHERE id = ?`,
    )
    .bind(updatedAt, instanceId)
    .run();
}

export async function deleteRemoteAccessSessionsByInstanceId(
  db: D1Database,
  instanceId: string,
): Promise<void> {
  await db
    .prepare("DELETE FROM remote_sessions WHERE device_id = ?")
    .bind(instanceId)
    .run();
}

export async function deleteRemoteShareGrantsByInstanceId(
  db: D1Database,
  instanceId: string,
): Promise<void> {
  await db
    .prepare("DELETE FROM remote_share_grants WHERE device_id = ?")
    .bind(instanceId)
    .run();
}

export async function deleteRemoteInstanceById(
  db: D1Database,
  instanceId: string,
): Promise<void> {
  await db
    .prepare("DELETE FROM remote_devices WHERE id = ?")
    .bind(instanceId)
    .run();
}

export function toRemoteInstanceView(
  row: RemoteInstanceRow,
  baseDomain: string | null = null,
): RemoteInstanceView {
  return {
    id: row.id,
    instanceInstallId: row.instance_install_id,
    displayName: row.display_name,
    platform: row.platform,
    appVersion: row.app_version,
    localOrigin: row.local_origin,
    systemDomainPrefix: row.system_domain_prefix,
    systemDomain: baseDomain
      ? `${row.system_domain_prefix}.${baseDomain}`
      : null,
    systemDomainClaimedAt: row.system_domain_claimed_at,
    customDomainPrefix: row.custom_domain_prefix,
    customDomain:
      row.custom_domain_prefix && baseDomain
        ? `${row.custom_domain_prefix}.${baseDomain}`
        : null,
    customDomainClaimedAt: row.custom_domain_claimed_at,
    customDomainExpiresAt: row.custom_domain_expires_at,
    status: row.status,
    lastSeenAt: row.last_seen_at,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
