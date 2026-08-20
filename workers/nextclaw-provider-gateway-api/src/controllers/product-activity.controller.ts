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
  PlatformRequestAuthService,
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
  const auth = await new PlatformRequestAuthService(c.env).resolveOptional(
    c.req.header("authorization"),
  );
  if (!auth.ok) {
    return auth.response;
  }
  try {
    await new ProductActivityService(c.env).ingest(parsed.input, auth.user);
  } catch (error) {
    if (error instanceof Error && error.message === "PRODUCT_ANALYTICS_UNAVAILABLE") {
      return apiError(c, 503, "PRODUCT_ANALYTICS_UNAVAILABLE", "Product analytics is temporarily unavailable.");
    }
    throw error;
  }
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
