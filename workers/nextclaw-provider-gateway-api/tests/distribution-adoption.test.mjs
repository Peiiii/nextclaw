import assert from "node:assert/strict";
import {
  parseGithubReleaseAssets,
  parseNpmDailyDownloads,
  selectDistributionAssetRows,
  shouldSnapshotPreviousDay,
} from "../dist/services/distribution-adoption.service.js";

const githubAssets = parseGithubReleaseAssets([{
  tag_name: "nextclaw@0.42.1",
  assets: [{ id: 1, name: "nextclaw-runtime-linux-x64-0.42.1.zip", download_count: 4 }],
}, {
  tag_name: "v0.42.0-desktop.1",
  assets: [
    { id: 2, name: "nextclaw-desktop_0.0.260_amd64.deb", download_count: 12 },
    { id: 3, name: "manifest-stable-win32-x64.json", download_count: 1 },
  ],
}]);

assert.deepEqual(githubAssets.map((asset) => ({
  kind: asset.artifactKind,
  platform: asset.platform,
  architecture: asset.architecture,
  count: asset.downloadCount,
})), [
  { kind: "npm_runtime_bundle", platform: "Linux", architecture: "x64", count: 4 },
  { kind: "desktop_installer", platform: "Linux", architecture: "x64", count: 12 },
  { kind: "update_metadata", platform: "Windows", architecture: "x64", count: 1 },
]);

assert.deepEqual(parseNpmDailyDownloads({ downloads: [
  { day: "2026-08-20", downloads: 20 },
  { day: "2026-08-19", downloads: 10 },
]}), [
  { date: "2026-08-19", downloads: 10 },
  { date: "2026-08-20", downloads: 20 },
]);
assert.equal(shouldSnapshotPreviousDay(new Date("2026-08-20T16:05:00.000Z")), true);
assert.equal(shouldSnapshotPreviousDay(new Date("2026-08-20T15:05:00.000Z")), false);

const pagedAssets = Array.from({ length: 25 }, (_, index) => ({
  source: "github_release",
  asset_key: String(index),
  release_tag: `v0.${index}`,
  asset_name: `nextclaw-desktop-${index}.dmg`,
  artifact_kind: "desktop_installer",
  platform: index % 2 === 0 ? "macOS" : "Windows",
  architecture: "x64",
  latest_download_count: index,
  first_observed_at: "2026-08-21T00:00:00.000Z",
  last_synced_at: "2026-08-21T00:00:00.000Z",
}));

assert.deepEqual(selectDistributionAssetRows(pagedAssets, {
  page: 2,
  pageSize: 10,
  query: "",
  artifactKind: null,
  platform: null,
}), {
  items: pagedAssets.slice(10, 20),
  page: 2,
  total: 25,
  totalPages: 3,
});
assert.deepEqual(selectDistributionAssetRows(pagedAssets, {
  page: 9,
  pageSize: 20,
  query: "v0.24",
  artifactKind: "desktop_installer",
  platform: "macOS",
}), {
  items: [pagedAssets[24]],
  page: 1,
  total: 1,
  totalPages: 1,
});

console.log("[distribution-adoption] passed");
