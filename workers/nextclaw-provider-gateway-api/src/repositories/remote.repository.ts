import type {
  RemoteAccessSessionRow,
  RemoteAccessSessionView,
  RemoteShareGrantRow,
  RemoteShareGrantView,
} from "@/types/platform";
import type { RemoteAccessUrlSet } from "@/services/remote-access.service";

function normalizeRemoteAccessSessionStatus(
  row: RemoteAccessSessionRow,
): RemoteAccessSessionView["status"] {
  if (row.revoked_at) {
    return "revoked";
  }
  return row.status;
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
  },
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO remote_sessions (
      id, token, user_id, device_id, status, source_type, source_grant_id, opened_by_user_id,
      expires_at, last_used_at, revoked_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, NULL, ?, ?)`,
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
      now,
    )
    .run();
}

export async function getRemoteAccessSessionByToken(
  db: D1Database,
  token: string,
): Promise<RemoteAccessSessionRow | null> {
  const row = await db
    .prepare(
      `SELECT id, token, user_id, device_id AS instance_id, status, source_type, source_grant_id, opened_by_user_id,
            expires_at, last_used_at, revoked_at, created_at, updated_at
       FROM remote_sessions
      WHERE token = ?`,
    )
    .bind(token)
    .first<RemoteAccessSessionRow>();
  return row ?? null;
}

export async function getRemoteAccessSessionById(
  db: D1Database,
  sessionId: string,
): Promise<RemoteAccessSessionRow | null> {
  const row = await db
    .prepare(
      `SELECT id, token, user_id, device_id AS instance_id, status, source_type, source_grant_id, opened_by_user_id,
            expires_at, last_used_at, revoked_at, created_at, updated_at
       FROM remote_sessions
      WHERE id = ?`,
    )
    .bind(sessionId)
    .first<RemoteAccessSessionRow>();
  return row ?? null;
}

export async function getActiveOwnerRemoteAccessSessionByInstanceId(
  db: D1Database,
  instanceId: string,
  nowIso: string,
): Promise<RemoteAccessSessionRow | null> {
  const row = await db
    .prepare(
      `SELECT id, token, user_id, device_id AS instance_id, status, source_type, source_grant_id, opened_by_user_id,
            expires_at, last_used_at, revoked_at, created_at, updated_at
       FROM remote_sessions
      WHERE device_id = ?
        AND source_type = 'owner_open'
        AND status = 'active'
        AND revoked_at IS NULL
        AND datetime(expires_at) > datetime(?)
      ORDER BY updated_at DESC, id DESC
      LIMIT 1`,
    )
    .bind(instanceId, nowIso)
    .first<RemoteAccessSessionRow>();
  return row ?? null;
}

export async function touchRemoteAccessSession(
  db: D1Database,
  sessionId: string,
  lastUsedAt: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE remote_sessions
        SET last_used_at = ?,
            updated_at = ?
      WHERE id = ?`,
    )
    .bind(lastUsedAt, lastUsedAt, sessionId)
    .run();
}

export async function closeRemoteAccessSessionsByGrantId(
  db: D1Database,
  grantId: string,
  revokedAt: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE remote_sessions
        SET status = 'closed',
            revoked_at = ?,
            updated_at = ?
      WHERE source_grant_id = ?
        AND status = 'active'
        AND revoked_at IS NULL`,
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
  },
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO remote_share_grants (
      id, token, owner_user_id, device_id, status, expires_at, revoked_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'active', ?, NULL, ?, ?)`,
    )
    .bind(
      payload.id,
      payload.token,
      payload.ownerUserId,
      payload.instanceId,
      payload.expiresAt,
      now,
      now,
    )
    .run();
}

export async function getRemoteShareGrantByToken(
  db: D1Database,
  token: string,
): Promise<RemoteShareGrantRow | null> {
  const row = await db
    .prepare(
      `SELECT id, token, owner_user_id, device_id AS instance_id, status, expires_at, revoked_at, created_at, updated_at
       FROM remote_share_grants
      WHERE token = ?`,
    )
    .bind(token)
    .first<RemoteShareGrantRow>();
  return row ?? null;
}

export async function getRemoteShareGrantById(
  db: D1Database,
  grantId: string,
): Promise<RemoteShareGrantRow | null> {
  const row = await db
    .prepare(
      `SELECT id, token, owner_user_id, device_id AS instance_id, status, expires_at, revoked_at, created_at, updated_at
       FROM remote_share_grants
      WHERE id = ?`,
    )
    .bind(grantId)
    .first<RemoteShareGrantRow>();
  return row ?? null;
}

export async function listRemoteShareGrantsByInstanceId(
  db: D1Database,
  instanceId: string,
): Promise<RemoteShareGrantRow[]> {
  const rows = await db
    .prepare(
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
      ORDER BY grants.updated_at DESC, grants.id DESC`,
    )
    .bind(instanceId)
    .all<RemoteShareGrantRow>();
  return rows.results ?? [];
}

export async function revokeRemoteShareGrant(
  db: D1Database,
  grantId: string,
  revokedAt: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE remote_share_grants
        SET status = 'revoked',
            revoked_at = ?,
            updated_at = ?
      WHERE id = ?`,
    )
    .bind(revokedAt, revokedAt, grantId)
    .run();
}

export function toRemoteAccessSessionView(
  row: RemoteAccessSessionRow,
  urls: RemoteAccessUrlSet,
): RemoteAccessSessionView {
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
    systemDomainOpenUrl: urls.systemDomainOpenUrl,
    customDomainOpenUrl: urls.customDomainOpenUrl,
  };
}

export function toRemoteShareGrantView(
  row: RemoteShareGrantRow,
  shareUrl: string,
): RemoteShareGrantView {
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
