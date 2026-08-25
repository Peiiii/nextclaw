import type { Context } from "hono";
import {
  parseProductActivityAudience,
  parseProductActivityEnvironment,
  parseProductActivityInput,
  parseProductActivityReleaseChannel,
  ProductActivityService,
} from "@/services/product-activity.service";
import type { Env } from "@/types/platform";
import {
  ensurePlatformBootstrap,
  requireAdminUser,
} from "@/services/platform.service";
import { apiError, parseBoundedInt, readJson } from "@/utils/platform.utils";

export async function productActivityIngestHandler(
  c: Context<{ Bindings: Env }>,
): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const parsed = parseProductActivityInput(await readJson(c));
  if (!parsed.ok) {
    return apiError(c, 400, parsed.code, parsed.message);
  }
  await new ProductActivityService(c.env).ingest(parsed.input);
  return c.body(null, 202);
}

export async function adminProductActivityOverviewHandler(
  c: Context<{ Bindings: Env }>,
): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const admin = await requireAdminUser(c);
  if (!admin.ok) {
    return admin.response;
  }
  const overview = await new ProductActivityService(c.env).readOverview({
    audience: parseProductActivityAudience(c.req.query("audience")),
    environment: parseProductActivityEnvironment(c.req.query("environment")),
    releaseChannel: parseProductActivityReleaseChannel(c.req.query("releaseChannel")),
    trendDays: parseBoundedInt(c.req.query("days"), 30, 7, 90),
  });
  return c.json({ ok: true, data: overview });
}
