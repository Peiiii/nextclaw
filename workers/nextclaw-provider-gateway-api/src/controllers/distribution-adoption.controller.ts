import type { Context } from "hono";
import { DistributionAdoptionService } from "@/services/distribution-adoption.service";
import {
  ensurePlatformBootstrap,
  requireAdminUser,
} from "@/services/platform.service";
import type {
  DistributionArtifactKind,
  DistributionAssetListQuery,
  DistributionAssetSortBy,
  DistributionSortDirection,
} from "@/types/distribution-adoption.types";
import type { Env } from "@/types/platform";

const ARTIFACT_KINDS = new Set<DistributionArtifactKind>([
  "npm_runtime_bundle",
  "desktop_installer",
  "desktop_portable",
  "desktop_runtime_bundle",
  "update_metadata",
  "other",
]);
const ASSET_SORT_FIELDS = new Set<DistributionAssetSortBy>([
  "default",
  "asset_name",
  "artifact_kind",
  "platform",
  "download_count",
  "today_downloads",
  "yesterday_downloads",
]);

export async function adminDistributionAdoptionOverviewHandler(
  c: Context<{ Bindings: Env }>,
): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const admin = await requireAdminUser(c);
  if (!admin.ok) return admin.response;
  const overview = await new DistributionAdoptionService(c.env).readOverview(parseAssetListQuery(c));
  return c.json({ ok: true, data: overview });
}

function parseAssetListQuery(c: Context<{ Bindings: Env }>): DistributionAssetListQuery {
  const pageSize = c.req.query("pageSize") === "20" ? 20 : 10;
  const artifactKind = c.req.query("artifactKind");
  const platform = c.req.query("platform")?.trim() ?? "";
  const sortBy = c.req.query("sortBy");
  const sortDirection = c.req.query("sortDirection");
  return {
    page: Math.max(1, Number.parseInt(c.req.query("page") ?? "1", 10) || 1),
    pageSize,
    query: (c.req.query("q") ?? "").trim().slice(0, 120),
    artifactKind: artifactKind && ARTIFACT_KINDS.has(artifactKind as DistributionArtifactKind)
      ? artifactKind as DistributionArtifactKind
      : null,
    platform: platform ? platform.slice(0, 64) : null,
    sortBy: sortBy && ASSET_SORT_FIELDS.has(sortBy as DistributionAssetSortBy)
      ? sortBy as DistributionAssetSortBy
      : "default",
    sortDirection: sortDirection === "asc" ? "asc" : "desc" as DistributionSortDirection,
  };
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
