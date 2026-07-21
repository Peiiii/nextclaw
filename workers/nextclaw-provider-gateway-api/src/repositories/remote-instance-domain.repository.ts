import type {
  RemoteInstanceDomainKind,
  RemoteInstanceDomainRow,
} from "@/types/platform";

const REMOTE_INSTANCE_DOMAIN_SELECT = `
  SELECT prefix, instance_id, kind, claimed_at, expires_at, created_at, updated_at
    FROM remote_instance_domains`;

export async function getRemoteInstanceDomainByPrefix(
  db: D1Database,
  prefix: string,
): Promise<RemoteInstanceDomainRow | null> {
  const row = await db
    .prepare(`${REMOTE_INSTANCE_DOMAIN_SELECT} WHERE prefix = ?`)
    .bind(prefix)
    .first<RemoteInstanceDomainRow>();
  return row ?? null;
}

export async function getRemoteInstanceDomainByKind(
  db: D1Database,
  instanceId: string,
  kind: RemoteInstanceDomainKind,
): Promise<RemoteInstanceDomainRow | null> {
  const row = await db
    .prepare(
      `${REMOTE_INSTANCE_DOMAIN_SELECT}
        WHERE instance_id = ?
          AND kind = ?`,
    )
    .bind(instanceId, kind)
    .first<RemoteInstanceDomainRow>();
  return row ?? null;
}

export async function createRemoteInstanceSystemDomain(
  db: D1Database,
  payload: { instanceId: string; prefix: string; claimedAt: string },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO remote_instance_domains (
        prefix, instance_id, kind, claimed_at, expires_at, created_at, updated_at
      ) VALUES (?, ?, 'system', ?, NULL, ?, ?)`,
    )
    .bind(
      payload.prefix,
      payload.instanceId,
      payload.claimedAt,
      payload.claimedAt,
      payload.claimedAt,
    )
    .run();
}

export async function setRemoteInstanceCustomDomain(
  db: D1Database,
  payload: {
    instanceId: string;
    prefix: string;
    claimedAt: string;
    expiresAt: string | null;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO remote_instance_domains (
        prefix, instance_id, kind, claimed_at, expires_at, created_at, updated_at
      ) VALUES (?, ?, 'custom', ?, ?, ?, ?)
      ON CONFLICT(instance_id, kind) DO UPDATE SET
        prefix = excluded.prefix,
        claimed_at = excluded.claimed_at,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at`,
    )
    .bind(
      payload.prefix,
      payload.instanceId,
      payload.claimedAt,
      payload.expiresAt,
      payload.claimedAt,
      payload.claimedAt,
    )
    .run();
}

export async function releaseRemoteInstanceCustomDomain(
  db: D1Database,
  instanceId: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      `DELETE FROM remote_instance_domains
        WHERE instance_id = ?
          AND kind = 'custom'`,
    )
    .bind(instanceId)
    .run();
  return Number(result.meta.changes ?? 0) > 0;
}

export async function releaseExpiredRemoteInstanceCustomDomain(
  db: D1Database,
  payload: { prefix: string; nowIso: string },
): Promise<boolean> {
  const result = await db
    .prepare(
      `DELETE FROM remote_instance_domains
        WHERE prefix = ?
          AND kind = 'custom'
          AND expires_at IS NOT NULL
          AND datetime(expires_at) <= datetime(?)`,
    )
    .bind(payload.prefix, payload.nowIso)
    .run();
  return Number(result.meta.changes ?? 0) > 0;
}
