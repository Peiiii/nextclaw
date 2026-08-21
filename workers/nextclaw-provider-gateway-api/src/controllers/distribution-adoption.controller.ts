import type { Context } from "hono";
import { DistributionAdoptionService } from "@/services/distribution-adoption.service";
import {
  ensurePlatformBootstrap,
  requireAdminUser,
} from "@/services/platform.service";
import type { Env } from "@/types/platform";

export async function adminDistributionAdoptionOverviewHandler(
  c: Context<{ Bindings: Env }>,
): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const admin = await requireAdminUser(c);
  if (!admin.ok) return admin.response;
  const overview = await new DistributionAdoptionService(c.env).readOverview();
  return c.json({ ok: true, data: overview });
}

export async function refreshAdminDistributionAdoptionHandler(
  c: Context<{ Bindings: Env }>,
): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const admin = await requireAdminUser(c);
  if (!admin.ok) return admin.response;
  const service = new DistributionAdoptionService(c.env);
  const result = await service.sync({ snapshotPreviousDay: false });
  const overview = await service.readOverview();
  return c.json({ ok: true, data: { result, overview } });
}
