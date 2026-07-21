import type { Context } from "hono";
import { appendAuditLog } from "@/repositories/platform.repository";
import {
  archiveRemoteInstance,
  deleteRemoteAccessSessionsByInstanceId,
  deleteRemoteInstanceById,
  deleteRemoteShareGrantsByInstanceId,
  getRemoteInstanceById,
  listRemoteInstancesByUserId,
  toRemoteInstanceView,
  unarchiveRemoteInstance,
} from "@/repositories/remote-instance.repository";
import { toRemoteAccessSessionView } from "@/repositories/remote.repository";
import {
  ensurePlatformBootstrap,
  requireAuthUser,
} from "@/services/platform.service";
import { RemoteAccessService } from "@/services/remote-access.service";
import type {
  Env,
  RemoteInstanceArchiveStatus,
  RemoteInstanceConnectionStatus,
  RemoteInstanceListQuery,
  RemoteInstanceSortBy,
  RemoteInstanceSortDirection,
} from "@/types/platform";
import { apiError, parseBoundedInt } from "@/utils/platform.utils";

function requireRemoteAccessUrls(
  c: Context<{ Bindings: Env }>,
  sessionId: string,
  token: string,
  prefixes: {
    systemDomainPrefix: string;
    customDomainPrefix: string | null;
  },
) {
  const urls = new RemoteAccessService(c).buildAccessUrlSet(
    sessionId,
    token,
    prefixes,
  );
  if (!urls) {
    return apiError(
      c,
      503,
      "REMOTE_ACCESS_DOMAIN_UNAVAILABLE",
      "Remote access public domain is not configured.",
    );
  }
  return urls;
}

function toRemoteInstanceResponse(
  c: Context<{ Bindings: Env }>,
  instance: Parameters<typeof toRemoteInstanceView>[0],
) {
  return toRemoteInstanceView(
    instance,
    c.env.REMOTE_ACCESS_BASE_DOMAIN?.trim() || null,
  );
}

function shouldIncludeArchivedInstances(
  c: Context<{ Bindings: Env }>,
): boolean {
  const raw = c.req.query("includeArchived")?.trim().toLowerCase() ?? "";
  return raw === "1" || raw === "true" || raw === "yes";
}

function readRemoteInstanceArchiveStatus(
  c: Context<{ Bindings: Env }>,
): RemoteInstanceArchiveStatus {
  const raw = c.req.query("archiveStatus")?.trim();
  if (raw === "active" || raw === "archived" || raw === "all") {
    return raw;
  }
  return shouldIncludeArchivedInstances(c) ? "all" : "active";
}

function readRemoteInstanceConnectionStatus(
  c: Context<{ Bindings: Env }>,
): RemoteInstanceConnectionStatus {
  const raw = c.req.query("connectionStatus")?.trim();
  return raw === "online" || raw === "offline" ? raw : "all";
}

function readRemoteInstanceSortBy(
  c: Context<{ Bindings: Env }>,
): RemoteInstanceSortBy {
  const raw = c.req.query("sortBy")?.trim();
  return raw === "displayName" || raw === "createdAt" ? raw : "lastSeenAt";
}

function readRemoteInstanceSortDirection(
  c: Context<{ Bindings: Env }>,
): RemoteInstanceSortDirection {
  return c.req.query("sortDirection")?.trim() === "asc" ? "asc" : "desc";
}

function readRemoteInstanceListQuery(
  c: Context<{ Bindings: Env }>,
): RemoteInstanceListQuery {
  return {
    archiveStatus: readRemoteInstanceArchiveStatus(c),
    connectionStatus: readRemoteInstanceConnectionStatus(c),
    q: (c.req.query("q") ?? "").trim().slice(0, 120),
    page: parseBoundedInt(c.req.query("page"), 1, 1, 999),
    pageSize: parseBoundedInt(c.req.query("pageSize"), 10, 1, 100),
    sortBy: readRemoteInstanceSortBy(c),
    sortDirection: readRemoteInstanceSortDirection(c),
  };
}

async function requireOwnedRemoteInstance(
  c: Context<{ Bindings: Env }>,
  userId: string,
  instanceId: string,
) {
  const instance = await getRemoteInstanceById(
    c.env.NEXTCLAW_PLATFORM_DB,
    instanceId,
  );
  if (!instance || instance.user_id !== userId) {
    return {
      ok: false as const,
      response: apiError(
        c,
        404,
        "INSTANCE_NOT_FOUND",
        "Remote instance not found.",
      ),
    };
  }
  return {
    ok: true as const,
    instance,
  };
}

export async function listRemoteInstancesHandler(
  c: Context<{ Bindings: Env }>,
): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }
  const query = readRemoteInstanceListQuery(c);
  const result = await listRemoteInstancesByUserId(
    c.env.NEXTCLAW_PLATFORM_DB,
    auth.user.id,
    query,
  );
  return c.json({
    ok: true,
    data: {
      ...query,
      total: result.total,
      totalPages:
        result.total === 0 ? 0 : Math.ceil(result.total / query.pageSize),
      items: result.rows.map((row) => toRemoteInstanceResponse(c, row)),
    },
  });
}

export async function openRemoteInstanceHandler(
  c: Context<{ Bindings: Env }>,
): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }

  const instanceId =
    c.req.param("instanceId")?.trim() || c.req.param("deviceId")?.trim() || "";
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

  const session = await new RemoteAccessService(c).createOwnerOpenSession(
    auth.user.id,
    instance.id,
  );
  const urls = requireRemoteAccessUrls(c, session.id, session.token, {
    systemDomainPrefix: instance.system_domain_prefix,
    customDomainPrefix: instance.custom_domain_prefix,
  });
  if (urls instanceof Response) {
    return urls;
  }

  await appendAuditLog(c.env.NEXTCLAW_PLATFORM_DB, {
    actorUserId: auth.user.id,
    action: "remote.access_session.created",
    targetType: "remote_access_session",
    targetId: session.id,
    beforeJson: null,
    afterJson: JSON.stringify({
      id: session.id,
      instanceId: instance.id,
      sourceType: "owner_open",
      expiresAt: session.expires_at,
    }),
    metadataJson: null,
  });

  return c.json({
    ok: true,
    data: toRemoteAccessSessionView(session, urls),
  });
}

export async function archiveRemoteInstanceHandler(
  c: Context<{ Bindings: Env }>,
): Promise<Response> {
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
        instance: toRemoteInstanceResponse(c, before),
      },
    });
  }

  const archivedAt = new Date().toISOString();
  await archiveRemoteInstance(
    c.env.NEXTCLAW_PLATFORM_DB,
    before.id,
    archivedAt,
  );
  const after = await getRemoteInstanceById(
    c.env.NEXTCLAW_PLATFORM_DB,
    before.id,
  );
  if (!after) {
    return apiError(
      c,
      500,
      "REMOTE_INSTANCE_ARCHIVE_FAILED",
      "Failed to archive remote instance.",
    );
  }

  await appendAuditLog(c.env.NEXTCLAW_PLATFORM_DB, {
    actorUserId: auth.user.id,
    action: "remote.instance.archived",
    targetType: "remote_instance",
    targetId: before.id,
    beforeJson: JSON.stringify(toRemoteInstanceResponse(c, before)),
    afterJson: JSON.stringify(toRemoteInstanceResponse(c, after)),
    metadataJson: null,
  });

  return c.json({
    ok: true,
    data: {
      instance: toRemoteInstanceResponse(c, after),
    },
  });
}

export async function unarchiveRemoteInstanceHandler(
  c: Context<{ Bindings: Env }>,
): Promise<Response> {
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
        instance: toRemoteInstanceResponse(c, before),
      },
    });
  }

  const updatedAt = new Date().toISOString();
  await unarchiveRemoteInstance(
    c.env.NEXTCLAW_PLATFORM_DB,
    before.id,
    updatedAt,
  );
  const after = await getRemoteInstanceById(
    c.env.NEXTCLAW_PLATFORM_DB,
    before.id,
  );
  if (!after) {
    return apiError(
      c,
      500,
      "REMOTE_INSTANCE_UNARCHIVE_FAILED",
      "Failed to restore remote instance.",
    );
  }

  await appendAuditLog(c.env.NEXTCLAW_PLATFORM_DB, {
    actorUserId: auth.user.id,
    action: "remote.instance.unarchived",
    targetType: "remote_instance",
    targetId: before.id,
    beforeJson: JSON.stringify(toRemoteInstanceResponse(c, before)),
    afterJson: JSON.stringify(toRemoteInstanceResponse(c, after)),
    metadataJson: null,
  });

  return c.json({
    ok: true,
    data: {
      instance: toRemoteInstanceResponse(c, after),
    },
  });
}

export async function deleteRemoteInstanceHandler(
  c: Context<{ Bindings: Env }>,
): Promise<Response> {
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
    return apiError(
      c,
      409,
      "INSTANCE_NOT_ARCHIVED",
      "Archive the remote instance before deleting it.",
    );
  }
  if (instance.status !== "offline") {
    return apiError(
      c,
      409,
      "INSTANCE_NOT_DELETABLE",
      "Only offline archived instances can be deleted.",
    );
  }

  await deleteRemoteAccessSessionsByInstanceId(
    c.env.NEXTCLAW_PLATFORM_DB,
    instance.id,
  );
  await deleteRemoteShareGrantsByInstanceId(
    c.env.NEXTCLAW_PLATFORM_DB,
    instance.id,
  );
  await deleteRemoteInstanceById(c.env.NEXTCLAW_PLATFORM_DB, instance.id);

  await appendAuditLog(c.env.NEXTCLAW_PLATFORM_DB, {
    actorUserId: auth.user.id,
    action: "remote.instance.deleted",
    targetType: "remote_instance",
    targetId: instance.id,
    beforeJson: JSON.stringify(toRemoteInstanceResponse(c, instance)),
    afterJson: null,
    metadataJson: JSON.stringify({
      deletedShareGrants: true,
      deletedSessions: true,
    }),
  });

  return c.json({
    ok: true,
    data: {
      deleted: true,
      instanceId: instance.id,
    },
  });
}

export const listRemoteDevicesHandler = listRemoteInstancesHandler;
export const openRemoteDeviceHandler = openRemoteInstanceHandler;
