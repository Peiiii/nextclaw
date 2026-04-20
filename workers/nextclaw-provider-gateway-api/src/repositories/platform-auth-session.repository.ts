import type { PlatformAuthSessionRow, PlatformAuthSessionStatus } from "@/types/platform";

export async function createPlatformAuthSession(
  db: D1Database,
  payload: {
    id: string;
    expiresAt: string;
  }
): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO platform_auth_sessions (
      id, user_id, status, expires_at, created_at, updated_at
    ) VALUES (?, NULL, 'pending', ?, ?, ?)`
  )
    .bind(payload.id, payload.expiresAt, now, now)
    .run();
}

export async function getPlatformAuthSessionById(
  db: D1Database,
  id: string
): Promise<PlatformAuthSessionRow | null> {
  const row = await db.prepare(
    `SELECT id, user_id, status, expires_at, created_at, updated_at
       FROM platform_auth_sessions
      WHERE id = ?`
  )
    .bind(id)
    .first<PlatformAuthSessionRow>();
  return row ?? null;
}

export async function updatePlatformAuthSessionStatus(
  db: D1Database,
  payload: {
    id: string;
    status: PlatformAuthSessionStatus;
    userId?: string | null;
    updatedAt?: string;
  }
): Promise<void> {
  const updatedAt = payload.updatedAt ?? new Date().toISOString();
  await db.prepare(
    `UPDATE platform_auth_sessions
        SET status = ?,
            user_id = ?,
            updated_at = ?
      WHERE id = ?`
  )
    .bind(payload.status, payload.userId ?? null, updatedAt, payload.id)
    .run();
}
