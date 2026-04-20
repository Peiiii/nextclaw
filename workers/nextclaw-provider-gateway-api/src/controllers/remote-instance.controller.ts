import type { Context } from "hono";
import { appendAuditLog } from "../repositories/platform.repository";
import {
  archiveRemoteInstance,
  createRemoteAccessSession,
  deleteRemoteAccessSessionsByInstanceId,
  deleteRemoteInstanceById,
  deleteRemoteShareGrantsByInstanceId,
  getRemoteInstanceById,
  getRemoteInstanceByInstallId,
  listRemoteInstancesByUserId,
  toRemoteAccessSessionView,
  toRemoteInstanceView,
  unarchiveRemoteInstance,
  upsertRemoteInstance,
} from "../repositories/remote.repository";
import { ensurePlatformBootstrap, requireAuthUser } from "../services/platform.service";
import {
  buildRemoteAccessUrlSet,
} from "../services/remote-access.service";
import type { Env } from "../types/platform";
import { DEFAULT_REMOTE_SESSION_TTL_SECONDS } from "../types/platform";
import {
  apiError,
  randomOpaqueToken,
  readJson,
  readString,
} from "../utils/platform.utils";

function requireRemoteAccessUrls(
  c: Context<{ Bindings: Env }>,
  sessionId: string,
  token: string
){
  const urls = buildRemoteAccessUrlSet(c, sessionId, token);
  if (!urls) {
    return apiError(c, 503, "REMOTE_ACCESS_DOMAIN_UNAVAILABLE", "Remote access public domain is not configured.");
  }
  return urls;
}

function shouldIncludeArchivedInstances(c: Context<{ Bindings: Env }>): boolean {
  const raw = c.req.query("includeArchived")?.trim().toLowerCase() ?? "";
  return raw === "1" || raw === "true" || raw === "yes";
}

function shouldAuditRemoteInstanceRegistration(params: {
  existing: Awaited<ReturnType<typeof getRemoteInstanceByInstallId>>;
  next: NonNullable<Awaited<ReturnType<typeof getRemoteInstanceById>>>;
}): boolean {
  const { existing, next } = params;
  if (!existing) {
    return true;
  }
  return existing.user_id !== next.user_id
    || existing.display_name !== next.display_name
    || existing.platform !== next.platform
    || existing.app_version !== next.app_version
    || existing.local_origin !== next.local_origin
    || existing.archived_at !== next.archived_at;
}

async function requireOwnedRemoteInstance(
  c: Context<{ Bindings: Env }>,
  userId: string,
  instanceId: string
) {
  const instance = await getRemoteInstanceById(c.env.NEXTCLAW_PLATFORM_DB, instanceId);
  if (!instance || instance.user_id !== userId) {
    return {
      ok: false as const,
      response: apiError(c, 404, "INSTANCE_NOT_FOUND", "Remote instance not found.")
    };
  }
  return {
    ok: true as const,
    instance
  };
}

export async function registerRemoteInstanceHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await readJson(c);
  const instanceInstallId =
    readString(body, "instanceInstallId").trim()
    || readString(body, "deviceInstallId").trim();
  const displayName = readString(body, "displayName").trim();
  const platform = readString(body, "platform").trim();
  const appVersion = readString(body, "appVersion").trim();
  const localOrigin = readString(body, "localOrigin").trim();
  const nowIso = new Date().toISOString();

  if (!instanceInstallId || !displayName || !platform || !appVersion || !localOrigin) {
    return apiError(c, 400, "INVALID_BODY", "instanceInstallId, displayName, platform, appVersion, and localOrigin are required.");
  }

  const existing = await getRemoteInstanceByInstallId(c.env.NEXTCLAW_PLATFORM_DB, instanceInstallId);
  if (existing && existing.user_id !== auth.user.id) {
    return apiError(c, 409, "INSTANCE_OWNED", "This instance is already linked to another account.");
  }

  const instanceId = existing?.id ?? crypto.randomUUID();
  await upsertRemoteInstance(c.env.NEXTCLAW_PLATFORM_DB, {
    id: instanceId,
    userId: auth.user.id,
    instanceInstallId,
    displayName,
    platform,
    appVersion,
    localOrigin,
    status: "offline",
    lastSeenAt: nowIso
  });

  const instance = await getRemoteInstanceById(c.env.NEXTCLAW_PLATFORM_DB, instanceId);
  if (!instance) {
    return apiError(c, 500, "REMOTE_INSTANCE_FAILED", "Failed to persist remote instance.");
  }

  if (shouldAuditRemoteInstanceRegistration({ existing, next: instance })) {
    await appendAuditLog(c.env.NEXTCLAW_PLATFORM_DB, {
      actorUserId: auth.user.id,
      action: existing ? "remote.instance.updated" : "remote.instance.created",
      targetType: "remote_instance",
      targetId: instance.id,
      beforeJson: existing ? JSON.stringify(toRemoteInstanceView(existing)) : null,
      afterJson: JSON.stringify(toRemoteInstanceView(instance)),
      metadataJson: null
    });
  }

  return c.json({
    ok: true,
    data: {
      instance: toRemoteInstanceView(instance)
    }
  });
}

export async function listRemoteInstancesHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }
  const rows = await listRemoteInstancesByUserId(c.env.NEXTCLAW_PLATFORM_DB, auth.user.id, {
    includeArchived: shouldIncludeArchivedInstances(c)
  });
  return c.json({ ok: true, data: { items: rows.map((row) => toRemoteInstanceView(row)) } });
}

export async function openRemoteInstanceHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }

  const instanceId = c.req.param("instanceId")?.trim() || c.req.param("deviceId")?.trim() || "";
  if (!instanceId) {
    return apiError(c, 400, "INVALID_INSTANCE", "instanceId is required.");
  }

  const owned = await requireOwnedRemoteInstance(c, auth.user.id, instanceId);
  if (!owned.ok) {
    return owned.response;
  }
  const instance = owned.instance;
  if (instance.status !== "online") {
    return apiError(c, 409, "INSTANCE_OFFLINE", "Remote instance is offline.");
  }

  const sessionId = crypto.randomUUID();
  const token = randomOpaqueToken();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const expiresAt = new Date(now + DEFAULT_REMOTE_SESSION_TTL_SECONDS * 1000).toISOString();

  await createRemoteAccessSession(c.env.NEXTCLAW_PLATFORM_DB, {
    id: sessionId,
    token,
    userId: auth.user.id,
    instanceId: instance.id,
    sourceType: "owner_open",
    openedByUserId: auth.user.id,
    expiresAt
  });

  const urls = requireRemoteAccessUrls(c, sessionId, token);
  if (urls instanceof Response) {
    return urls;
  }

  await appendAuditLog(c.env.NEXTCLAW_PLATFORM_DB, {
    actorUserId: auth.user.id,
    action: "remote.access_session.created",
    targetType: "remote_access_session",
    targetId: sessionId,
    beforeJson: null,
    afterJson: JSON.stringify({
      id: sessionId,
      instanceId: instance.id,
      sourceType: "owner_open",
      expiresAt
    }),
    metadataJson: null
  });

  return c.json({
    ok: true,
    data: toRemoteAccessSessionView({
      id: sessionId,
      token,
      user_id: auth.user.id,
      instance_id: instance.id,
      status: "active",
      source_type: "owner_open",
      source_grant_id: null,
      opened_by_user_id: auth.user.id,
      expires_at: expiresAt,
      last_used_at: nowIso,
      revoked_at: null,
      created_at: nowIso,
      updated_at: nowIso
    }, urls)
  });
}

export async function archiveRemoteInstanceHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }

  const instanceId = c.req.param("instanceId")?.trim() ?? "";
  if (!instanceId) {
    return apiError(c, 400, "INVALID_INSTANCE", "instanceId is required.");
  }

  const owned = await requireOwnedRemoteInstance(c, auth.user.id, instanceId);
  if (!owned.ok) {
    return owned.response;
  }
  const before = owned.instance;
  if (before.archived_at) {
    return c.json({
      ok: true,
      data: {
        instance: toRemoteInstanceView(before)
      }
    });
  }

  const archivedAt = new Date().toISOString();
  await archiveRemoteInstance(c.env.NEXTCLAW_PLATFORM_DB, before.id, archivedAt);
  const after = await getRemoteInstanceById(c.env.NEXTCLAW_PLATFORM_DB, before.id);
  if (!after) {
    return apiError(c, 500, "REMOTE_INSTANCE_ARCHIVE_FAILED", "Failed to archive remote instance.");
  }

  await appendAuditLog(c.env.NEXTCLAW_PLATFORM_DB, {
    actorUserId: auth.user.id,
    action: "remote.instance.archived",
    targetType: "remote_instance",
    targetId: before.id,
    beforeJson: JSON.stringify(toRemoteInstanceView(before)),
    afterJson: JSON.stringify(toRemoteInstanceView(after)),
    metadataJson: null
  });

  return c.json({
    ok: true,
    data: {
      instance: toRemoteInstanceView(after)
    }
  });
}

export async function unarchiveRemoteInstanceHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }

  const instanceId = c.req.param("instanceId")?.trim() ?? "";
  if (!instanceId) {
    return apiError(c, 400, "INVALID_INSTANCE", "instanceId is required.");
  }

  const owned = await requireOwnedRemoteInstance(c, auth.user.id, instanceId);
  if (!owned.ok) {
    return owned.response;
  }
  const before = owned.instance;
  if (!before.archived_at) {
    return c.json({
      ok: true,
      data: {
        instance: toRemoteInstanceView(before)
      }
    });
  }

  const updatedAt = new Date().toISOString();
  await unarchiveRemoteInstance(c.env.NEXTCLAW_PLATFORM_DB, before.id, updatedAt);
  const after = await getRemoteInstanceById(c.env.NEXTCLAW_PLATFORM_DB, before.id);
  if (!after) {
    return apiError(c, 500, "REMOTE_INSTANCE_UNARCHIVE_FAILED", "Failed to restore remote instance.");
  }

  await appendAuditLog(c.env.NEXTCLAW_PLATFORM_DB, {
    actorUserId: auth.user.id,
    action: "remote.instance.unarchived",
    targetType: "remote_instance",
    targetId: before.id,
    beforeJson: JSON.stringify(toRemoteInstanceView(before)),
    afterJson: JSON.stringify(toRemoteInstanceView(after)),
    metadataJson: null
  });

  return c.json({
    ok: true,
    data: {
      instance: toRemoteInstanceView(after)
    }
  });
}

export async function deleteRemoteInstanceHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }

  const instanceId = c.req.param("instanceId")?.trim() ?? "";
  if (!instanceId) {
    return apiError(c, 400, "INVALID_INSTANCE", "instanceId is required.");
  }

  const owned = await requireOwnedRemoteInstance(c, auth.user.id, instanceId);
  if (!owned.ok) {
    return owned.response;
  }
  const instance = owned.instance;
  if (!instance.archived_at) {
    return apiError(c, 409, "INSTANCE_NOT_ARCHIVED", "Archive the remote instance before deleting it.");
  }
  if (instance.status !== "offline") {
    return apiError(c, 409, "INSTANCE_NOT_DELETABLE", "Only offline archived instances can be deleted.");
  }

  await deleteRemoteAccessSessionsByInstanceId(c.env.NEXTCLAW_PLATFORM_DB, instance.id);
  await deleteRemoteShareGrantsByInstanceId(c.env.NEXTCLAW_PLATFORM_DB, instance.id);
  await deleteRemoteInstanceById(c.env.NEXTCLAW_PLATFORM_DB, instance.id);

  await appendAuditLog(c.env.NEXTCLAW_PLATFORM_DB, {
    actorUserId: auth.user.id,
    action: "remote.instance.deleted",
    targetType: "remote_instance",
    targetId: instance.id,
    beforeJson: JSON.stringify(toRemoteInstanceView(instance)),
    afterJson: null,
    metadataJson: JSON.stringify({
      deletedShareGrants: true,
      deletedSessions: true
    })
  });

  return c.json({
    ok: true,
    data: {
      deleted: true,
      instanceId: instance.id
    }
  });
}

export const registerRemoteDeviceHandler = registerRemoteInstanceHandler;
export const listRemoteDevicesHandler = listRemoteInstancesHandler;
export const openRemoteDeviceHandler = openRemoteInstanceHandler;
