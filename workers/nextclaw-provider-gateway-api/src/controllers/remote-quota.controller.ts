import type { Context } from "hono";
import { readRemoteQuotaPlatformSummary, readRemoteQuotaUserSummary } from "@/repositories/remote-quota.repository";
import { ensurePlatformBootstrap, requireAuthUser } from "@/services/platform.service";
import type { Env } from "@/types/platform";
import { apiError } from "@/utils/platform.utils";

export async function remoteQuotaSummaryV2Handler(c: Context<{ Bindings: Env }>): Promise<Response> {
  const summary = await readAuthorizedUserQuota(c);
  return summary instanceof Response
    ? summary
    : c.json({ ok: true, data: summary });
}

async function readAuthorizedUserQuota(c: Context<{ Bindings: Env }>) {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }

  const summary = await readRemoteQuotaUserSummary(c.env, auth.user.id);
  if (!summary.ok) {
    return apiError(c, 503, summary.error.code, summary.error.message);
  }
  return summary.data;
}

export async function adminRemoteQuotaSummaryV2Handler(c: Context<{ Bindings: Env }>): Promise<Response> {
  const summary = await readAuthorizedPlatformQuota(c);
  return summary instanceof Response
    ? summary
    : c.json({ ok: true, data: summary });
}

async function readAuthorizedPlatformQuota(c: Context<{ Bindings: Env }>) {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }
  if (auth.user.role !== "admin") {
    return apiError(c, 403, "FORBIDDEN", "Admin role is required.");
  }

  const summary = await readRemoteQuotaPlatformSummary(c.env);
  if (!summary.ok) {
    return apiError(c, 503, summary.error.code, summary.error.message);
  }
  return summary.data;
}
