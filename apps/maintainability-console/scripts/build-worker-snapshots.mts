#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type {
  ApiEnvelope,
  MaintainabilityOverview,
  MaintainabilityProfile
} from "../shared/maintainability.types.ts";
import { MaintainabilityDataService } from "../server/maintainability-data.service.ts";

const appRoot = process.cwd();
const outputDir = resolve(appRoot, "dist/client/_snapshot");
const service = new MaintainabilityDataService(appRoot);
const profiles: MaintainabilityProfile[] = ["source", "repo-volume"];

await mkdir(outputDir, { recursive: true });

for (const profile of profiles) {
  const overview = await service.getOverview(profile);
  const snapshot = createPublishedSnapshot(overview);
  const filePath = resolve(outputDir, `maintainability-overview-${profile}.json`);
  const payload: ApiEnvelope<MaintainabilityOverview> = {
    ok: true,
    data: snapshot
  };
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`[maintainability-console] wrote ${filePath}`);
}

function createPublishedSnapshot(overview: MaintainabilityOverview): MaintainabilityOverview {
  return {
    ...overview,
    deliveryMode: "published-snapshot",
    repoRoot: "nextbot"
  };
}
