import type {
  RemoteAccessSessionRow,
  RemoteAccessSessionView,
  RemoteInstanceRow,
  RemoteInstanceView,
  RemoteShareGrantRow,
  RemoteShareGrantView,
} from "../types/platform";
import type { RemoteAccessUrlSet } from "../services/remote-access.service";

function normalizeRemoteAccessSessionStatus(row: RemoteAccessSessionRow): RemoteAccessSessionView["status"] {
  if (row.revoked_at) {
    return "revoked";
  }
  return row.status;
}

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
  options: { includeArchived?: boolean } = {}
): Promise<RemoteInstanceRow[]> {
  const includeArchived = options.includeArchived === true;
  const rows = await db.prepare(
    `SELECT id, user_id, device_install_id AS instance_install_id, display_name, platform, app_version,
            local_origin, status, last_seen_at, archived_at, created_at, updated_at
       FROM remote_devices
      WHERE user_id = ?
        AND (? = 1 OR archived_at IS NULL)
      ORDER BY
        CASE WHEN archived_at IS NULL THEN 0 ELSE 1 END ASC,
        updated_at DESC,
        id DESC`
  )
    .bind(userId, includeArchived ? 1 : 0)
    .all<RemoteInstanceRow>();
  return rows.results ?? [];
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
  payload: {
    status: "online" | "offline";
    lastSeenAt: string;
  }
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
  await db.prepare(
    `DELETE FROM remote_sessions
      WHERE device_id = ?`
  )
    .bind(instanceId)
    .run();
}

export async function deleteRemoteShareGrantsByInstanceId(db: D1Database, instanceId: string): Promise<void> {
  await db.prepare(
    `DELETE FROM remote_share_grants
      WHERE device_id = ?`
  )
    .bind(instanceId)
    .run();
}

export async function deleteRemoteInstanceById(db: D1Database, instanceId: string): Promise<void> {
  await db.prepare(
    `DELETE FROM remote_devices
      WHERE id = ?`
  )
    .bind(instanceId)
    .run();
}

export async function createRemoteAccessSession(
  db: D1Database,
  payload: {
    id: string;
    token: string;
    userId: string;
    instanceId: string;
    sourceType: "owner_open" | "share_grant";
    sourceGrantId?: string | null;
    openedByUserId?: string | null;
    expiresAt: string;
  }
): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO remote_sessions (
      id, token, user_id, device_id, status, source_type, source_grant_id, opened_by_user_id,
      expires_at, last_used_at, revoked_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, NULL, ?, ?)`
  )
    .bind(
      payload.id,
      payload.token,
      payload.userId,
      payload.instanceId,
      payload.sourceType,
      payload.sourceGrantId ?? null,
      payload.openedByUserId ?? null,
      payload.expiresAt,
      now,
      now,
      now
    )
    .run();
}

export async function getRemoteAccessSessionByToken(db: D1Database, token: string): Promise<RemoteAccessSessionRow | null> {
  const row = await db.prepare(
    `SELECT id, token, user_id, device_id AS instance_id, status, source_type, source_grant_id, opened_by_user_id,
            expires_at, last_used_at, revoked_at, created_at, updated_at
       FROM remote_sessions
      WHERE token = ?`
  )
    .bind(token)
    .first<RemoteAccessSessionRow>();
  return row ?? null;
}

export async function getRemoteAccessSessionById(db: D1Database, sessionId: string): Promise<RemoteAccessSessionRow | null> {
  const row = await db.prepare(
    `SELECT id, token, user_id, device_id AS instance_id, status, source_type, source_grant_id, opened_by_user_id,
            expires_at, last_used_at, revoked_at, created_at, updated_at
       FROM remote_sessions
      WHERE id = ?`
  )
    .bind(sessionId)
    .first<RemoteAccessSessionRow>();
  return row ?? null;
}

export async function touchRemoteAccessSession(db: D1Database, sessionId: string, lastUsedAt: string): Promise<void> {
  await db.prepare(
    `UPDATE remote_sessions
        SET last_used_at = ?,
            updated_at = ?
      WHERE id = ?`
  )
    .bind(lastUsedAt, lastUsedAt, sessionId)
    .run();
}

export async function closeRemoteAccessSessionsByGrantId(db: D1Database, grantId: string, revokedAt: string): Promise<void> {
  await db.prepare(
    `UPDATE remote_sessions
        SET status = 'closed',
            revoked_at = ?,
            updated_at = ?
      WHERE source_grant_id = ?
        AND status = 'active'
        AND revoked_at IS NULL`
  )
    .bind(revokedAt, revokedAt, grantId)
    .run();
}

export async function createRemoteShareGrant(
  db: D1Database,
  payload: {
    id: string;
    token: string;
    ownerUserId: string;
    instanceId: string;
    expiresAt: string;
  }
): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO remote_share_grants (
      id, token, owner_user_id, device_id, status, expires_at, revoked_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'active', ?, NULL, ?, ?)`
  )
    .bind(payload.id, payload.token, payload.ownerUserId, payload.instanceId, payload.expiresAt, now, now)
    .run();
}

export async function getRemoteShareGrantByToken(db: D1Database, token: string): Promise<RemoteShareGrantRow | null> {
  const row = await db.prepare(
    `SELECT id, token, owner_user_id, device_id AS instance_id, status, expires_at, revoked_at, created_at, updated_at
       FROM remote_share_grants
      WHERE token = ?`
  )
    .bind(token)
    .first<RemoteShareGrantRow>();
  return row ?? null;
}

export async function getRemoteShareGrantById(db: D1Database, grantId: string): Promise<RemoteShareGrantRow | null> {
  const row = await db.prepare(
    `SELECT id, token, owner_user_id, device_id AS instance_id, status, expires_at, revoked_at, created_at, updated_at
       FROM remote_share_grants
      WHERE id = ?`
  )
    .bind(grantId)
    .first<RemoteShareGrantRow>();
  return row ?? null;
}

export async function listRemoteShareGrantsByInstanceId(db: D1Database, instanceId: string): Promise<RemoteShareGrantRow[]> {
  const rows = await db.prepare(
    `SELECT grants.id, grants.token, grants.owner_user_id, grants.device_id AS instance_id, grants.status,
            grants.expires_at, grants.revoked_at, grants.created_at, grants.updated_at,
            (
              SELECT COUNT(1)
                FROM remote_sessions sessions
               WHERE sessions.source_grant_id = grants.id
                 AND sessions.status = 'active'
                 AND sessions.revoked_at IS NULL
                 AND datetime(sessions.expires_at) > datetime('now')
            ) AS active_session_count
       FROM remote_share_grants grants
      WHERE grants.device_id = ?
      ORDER BY grants.updated_at DESC, grants.id DESC`
  )
    .bind(instanceId)
    .all<RemoteShareGrantRow>();
  return rows.results ?? [];
}

export async function revokeRemoteShareGrant(db: D1Database, grantId: string, revokedAt: string): Promise<void> {
  await db.prepare(
    `UPDATE remote_share_grants
        SET status = 'revoked',
            revoked_at = ?,
            updated_at = ?
      WHERE id = ?`
  )
    .bind(revokedAt, revokedAt, grantId)
    .run();
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

export function toRemoteAccessSessionView(row: RemoteAccessSessionRow, urls: RemoteAccessUrlSet): RemoteAccessSessionView {
  return {
    id: row.id,
    instanceId: row.instance_id,
    status: normalizeRemoteAccessSessionStatus(row),
    sourceType: row.source_type,
    sourceGrantId: row.source_grant_id,
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    openUrl: urls.openUrl,
    fixedDomainOpenUrl: urls.fixedDomainOpenUrl,
  };
}

export function toRemoteShareGrantView(row: RemoteShareGrantRow, shareUrl: string): RemoteShareGrantView {
  return {
    id: row.id,
    instanceId: row.instance_id,
    status: row.status,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    shareUrl,
    activeSessionCount: Number(row.active_session_count ?? 0),
  };
}
