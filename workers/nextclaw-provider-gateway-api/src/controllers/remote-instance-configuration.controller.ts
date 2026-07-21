import type { Context } from "hono";
import { appendAuditLog } from "@/repositories/platform.repository";
import {
  getRemoteInstanceById,
  toRemoteInstanceView,
} from "@/repositories/remote-instance.repository";
import type { getRemoteInstanceByInstallId } from "@/repositories/remote-instance.repository";
import {
  ensurePlatformBootstrap,
  requireAuthUser,
} from "@/services/platform.service";
import { RemoteInstanceDomainService } from "@/services/remote-instance-domain.service";
import { RemoteInstanceRegistrationService } from "@/services/remote-instance-registration.service";
import type { Env } from "@/types/platform";
import { apiError, readJson, readString } from "@/utils/platform.utils";

function createRemoteInstanceDomainService(
  c: Context<{ Bindings: Env }>,
): RemoteInstanceDomainService {
  return new RemoteInstanceDomainService(c.env.NEXTCLAW_PLATFORM_DB, {
    baseDomain: c.env.REMOTE_ACCESS_BASE_DOMAIN,
    fixedDomain: c.env.REMOTE_ACCESS_FIXED_DOMAIN,
  });
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

function shouldAuditRemoteInstanceRegistration(params: {
  existing: Awaited<ReturnType<typeof getRemoteInstanceByInstallId>>;
  next: NonNullable<Awaited<ReturnType<typeof getRemoteInstanceById>>>;
}): boolean {
  const { existing, next } = params;
  if (!existing) {
    return true;
  }
  return (
    existing.user_id !== next.user_id ||
    existing.display_name !== next.display_name ||
    existing.platform !== next.platform ||
    existing.app_version !== next.app_version ||
    existing.local_origin !== next.local_origin ||
    existing.archived_at !== next.archived_at
  );
}

export async function registerRemoteInstanceHandler(
  c: Context<{ Bindings: Env }>,
): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await readJson(c);
  const instanceInstallId =
    readString(body, "instanceInstallId").trim() ||
    readString(body, "deviceInstallId").trim();
  const legacyInstanceInstallId = readString(
    body,
    "legacyInstanceInstallId",
  ).trim();
  const displayName = readString(body, "displayName").trim();
  const platform = readString(body, "platform").trim();
  const appVersion = readString(body, "appVersion").trim();
  const localOrigin = readString(body, "localOrigin").trim();
  const nowIso = new Date().toISOString();

  if (
    !instanceInstallId ||
    !displayName ||
    !platform ||
    !appVersion ||
    !localOrigin
  ) {
    return apiError(
      c,
      400,
      "INVALID_BODY",
      "instanceInstallId, displayName, platform, appVersion, and localOrigin are required.",
    );
  }

  const registration = await new RemoteInstanceRegistrationService(
    c.env.NEXTCLAW_PLATFORM_DB,
    auth.user.id,
    createRemoteInstanceDomainService(c),
  ).register({
    instanceInstallId,
    legacyInstanceInstallId,
    displayName,
    platform,
    appVersion,
    localOrigin,
    nowIso,
  });
  if (!registration.ok) {
    return registration.reason === "owned"
      ? apiError(
          c,
          409,
          "INSTANCE_OWNED",
          "This instance is already linked to another account.",
        )
      : apiError(
          c,
          500,
          "REMOTE_INSTANCE_FAILED",
          "Failed to persist remote instance.",
        );
  }
  const { before, instance } = registration;

  if (
    shouldAuditRemoteInstanceRegistration({ existing: before, next: instance })
  ) {
    await appendAuditLog(c.env.NEXTCLAW_PLATFORM_DB, {
      actorUserId: auth.user.id,
      action: before ? "remote.instance.updated" : "remote.instance.created",
      targetType: "remote_instance",
      targetId: instance.id,
      beforeJson: before
        ? JSON.stringify(toRemoteInstanceResponse(c, before))
        : null,
      afterJson: JSON.stringify(toRemoteInstanceResponse(c, instance)),
      metadataJson: null,
    });
  }

  return c.json({
    ok: true,
    data: { instance: toRemoteInstanceResponse(c, instance) },
  });
}

export async function updateRemoteInstanceDomainHandler(
  c: Context<{ Bindings: Env }>,
): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }
  const instanceId = c.req.param("instanceId")?.trim() ?? "";
  const instance = await getRemoteInstanceById(
    c.env.NEXTCLAW_PLATFORM_DB,
    instanceId,
  );
  if (!instance || instance.user_id !== auth.user.id) {
    return apiError(c, 404, "INSTANCE_NOT_FOUND", "Remote instance not found.");
  }

  const body = await readJson(c);
  const result = await createRemoteInstanceDomainService(c).claimCustom(
    instance,
    readString(body, "prefix"),
  );
  if (!result.ok) {
    const error = {
      invalid: [
        400,
        "INVALID_REMOTE_DOMAIN",
        "Use 1-63 lowercase letters, numbers, or hyphens; start and end with a letter or number.",
      ],
      reserved: [
        409,
        "REMOTE_DOMAIN_RESERVED",
        "This remote domain name is reserved.",
      ],
      taken: [
        409,
        "REMOTE_DOMAIN_TAKEN",
        "This remote domain name is already in use.",
      ],
    }[result.reason] as [400 | 409, string, string];
    return apiError(c, ...error);
  }

  await appendAuditLog(c.env.NEXTCLAW_PLATFORM_DB, {
    actorUserId: auth.user.id,
    action: "remote.instance.domain_updated",
    targetType: "remote_instance",
    targetId: result.instance.id,
    beforeJson: JSON.stringify(toRemoteInstanceResponse(c, instance)),
    afterJson: JSON.stringify(toRemoteInstanceResponse(c, result.instance)),
    metadataJson: null,
  });
  return c.json({
    ok: true,
    data: { instance: toRemoteInstanceResponse(c, result.instance) },
  });
}

export async function releaseRemoteInstanceDomainHandler(
  c: Context<{ Bindings: Env }>,
): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }
  const instanceId = c.req.param("instanceId")?.trim() ?? "";
  const instance = await getRemoteInstanceById(
    c.env.NEXTCLAW_PLATFORM_DB,
    instanceId,
  );
  if (!instance || instance.user_id !== auth.user.id) {
    return apiError(c, 404, "INSTANCE_NOT_FOUND", "Remote instance not found.");
  }
  if (!instance.custom_domain_prefix) {
    return c.json({
      ok: true,
      data: { instance: toRemoteInstanceResponse(c, instance) },
    });
  }

  const updated =
    await createRemoteInstanceDomainService(c).releaseCustom(instance);
  await appendAuditLog(c.env.NEXTCLAW_PLATFORM_DB, {
    actorUserId: auth.user.id,
    action: "remote.instance.domain_released",
    targetType: "remote_instance",
    targetId: updated.id,
    beforeJson: JSON.stringify(toRemoteInstanceResponse(c, instance)),
    afterJson: JSON.stringify(toRemoteInstanceResponse(c, updated)),
    metadataJson: null,
  });
  return c.json({
    ok: true,
    data: { instance: toRemoteInstanceResponse(c, updated) },
  });
}

export const registerRemoteDeviceHandler = registerRemoteInstanceHandler;
