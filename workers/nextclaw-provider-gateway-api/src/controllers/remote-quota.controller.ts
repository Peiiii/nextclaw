import type { Context } from "hono";
import { readRemoteQuotaPlatformSummary, readRemoteQuotaUserSummary } from "../services/remote-quota-guard.service";
import { ensurePlatformBootstrap, requireAuthUser } from "../services/platform.service";
import type { Env } from "../types/platform";
import { apiError } from "../utils/platform.utils";

export async function remoteQuotaSummaryHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }

  const summary = await readRemoteQuotaUserSummary(c.env, auth.user.id);
  if (!summary.ok) {
    return apiError(c, 503, summary.error.code, summary.error.message);
  }
  return c.json({
    ok: true,
    data: summary.data
  });
}

export async function adminRemoteQuotaSummaryHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
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
  return c.json({
    ok: true,
    data: summary.data
  });
}
