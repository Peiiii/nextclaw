import { describe, expect, it } from "vitest";
import type { MarketplaceAppItemRow } from "@/infrastructure/apps/app-marketplace.types";
import { MarketplaceAppRecordMapper } from "@/infrastructure/apps/marketplace-app-record.service";

describe("MarketplaceAppRecordMapper visuals", () => {
  it("projects icon and cover files into public asset URLs", () => {
    const row = buildRow();

    expect(new MarketplaceAppRecordMapper().mapItemSummary(row)).toMatchObject({
      accentColor: "#74816B",
      coverUrl: "https://apps-registry.nextclaw.io/api/v1/apps/items/personal-organizer/files/blob?path=marketplace-assets%2Fcover.webp",
      iconUrl: "https://apps-registry.nextclaw.io/api/v1/apps/items/personal-organizer/files/blob?path=assets%2Ficon.svg",
    });
    expect(new MarketplaceAppRecordMapper().mapItemSummary(row).install).toEqual({
      kind: "registry",
      spec: "nextclaw.personal-organizer",
      registry: "https://apps-registry.nextclaw.io/api/v1/apps/registry/",
    });
  });

  it("projects the canonical public-listing assessment for admin review", () => {
    const row = buildRow();
    row.owner_scope = "peiiii";
    row.app_id = "peiiii.daily-feed";
    row.manifest_json = JSON.stringify({
      schemaVersion: 2,
      components: [{ kind: "service", path: "components/daily-feed-service" }],
    });

    expect(new MarketplaceAppRecordMapper().mapAdminDetail(row, []).publicListing).toEqual({
      eligible: true,
      reason: "community-native-process",
    });
  });

  it("projects one or multiple declared targets into Marketplace platform labels", () => {
    const row = buildRow();
    row.manifest_json = JSON.stringify({
      schemaVersion: 2,
      id: row.app_id,
      name: row.name,
      version: row.latest_version,
      distribution: {
        mode: "targeted",
        targets: [
          { kind: "native", os: "darwin", arch: "arm64" },
          { kind: "native", os: "linux", arch: "x64", abi: "gnu" },
        ],
      },
      components: [{ kind: "service", path: "services/data" }],
    });

    expect(new MarketplaceAppRecordMapper().mapItemSummary(row).availability).toEqual({
      mode: "targeted",
      targets: ["darwin-arm64", "linux-x64-gnu"],
      operatingSystems: ["darwin", "linux"],
    });
  });
});

function buildRow(): MarketplaceAppItemRow {
  return {
    id: "app-personal-organizer",
    slug: "personal-organizer",
    app_id: "nextclaw.personal-organizer",
    owner_scope: "nextclaw",
    owner_user_id: null,
    owner_visibility: "public",
    owner_deleted_at: null,
    app_name: "personal-organizer",
    publish_status: "published",
    published_by_type: "admin",
    review_note: null,
    reviewed_at: null,
    name: "Personal Space",
    summary: "A calm personal space.",
    summary_i18n: '{"en":"A calm personal space."}',
    description: null,
    description_i18n: null,
    tags: '["personal"]',
    author: "NextClaw",
    source_repo: null,
    homepage: null,
    featured: 1,
    publisher_id: "nextclaw",
    publisher_name: "NextClaw",
    publisher_url: "https://nextclaw.io",
    cover_path: "marketplace-assets/cover.webp",
    accent_color: "#74816B",
    icon_sha256: null,
    cover_sha256: null,
    latest_version: "0.1.1",
    manifest_schema_version: 2,
    catalog_visibility: "listed",
    manifest_json: '{"schemaVersion":2,"id":"nextclaw.personal-organizer","name":"Personal Space","version":"0.1.1","icon":"assets/icon.svg","components":[{"kind":"panel","path":"panels/todos.panel"}]}',
    permissions_json: "{}",
    published_at: "2026-08-12T00:00:00.000Z",
    updated_at: "2026-08-12T00:00:00.000Z",
  };
}
