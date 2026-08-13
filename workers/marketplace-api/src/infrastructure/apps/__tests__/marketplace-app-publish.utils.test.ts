import { describe, expect, it, vi } from "vitest";
import type { MarketplaceSkillPublishActor } from "@/infrastructure/skills/d1-section-types";
import { D1MarketplaceAppDataSource } from "@/infrastructure/apps/d1-marketplace-app.repository";
import {
  assertAppVersionCanBeReplaced,
  assertPersonalPublishedAppIsImmutable,
  type ExistingAppRow,
  type MarketplaceResolvedAppIdentity,
} from "@/infrastructure/apps/marketplace-app-publish.utils";

const personalActor: MarketplaceSkillPublishActor = {
  authType: "platform_user",
  role: "user",
  userId: "user-1",
  username: "peiwang",
};

const identity: MarketplaceResolvedAppIdentity = {
  ownerScope: "peiwang",
  ownerUserId: "user-1",
  appName: "notes",
  slug: "peiwang--notes",
  appId: "peiwang.notes",
};

const existing: ExistingAppRow = {
  id: "app-notes",
  slug: "peiwang--notes",
  app_id: "peiwang.notes",
  owner_scope: "peiwang",
  owner_user_id: "user-1",
  app_name: "notes",
  publish_status: "published",
  published_at: "2026-08-13T00:00:00.000Z",
};

describe("assertPersonalPublishedAppIsImmutable", () => {
  it("rejects personal updates after an app is published", () => {
    expect(() =>
      assertPersonalPublishedAppIsImmutable(existing, identity, personalActor),
    ).toThrow("current published version remains available");
  });

  it("allows pending or rejected personal submissions to be replaced", () => {
    expect(() =>
      assertPersonalPublishedAppIsImmutable(
        { ...existing, publish_status: "pending" },
        identity,
        personalActor,
      ),
    ).not.toThrow();
    expect(() =>
      assertPersonalPublishedAppIsImmutable(
        { ...existing, publish_status: "rejected" },
        identity,
        personalActor,
      ),
    ).not.toThrow();
  });

  it("allows an admin to update a published item", () => {
    expect(() =>
      assertPersonalPublishedAppIsImmutable(existing, identity, {
        ...personalActor,
        role: "admin",
      }),
    ).not.toThrow();
  });
});

describe("assertAppVersionCanBeReplaced", () => {
  it("allows a pending or rejected submission to replace the same version", () => {
    for (const publishStatus of ["pending", "rejected"]) {
      expect(() =>
        assertAppVersionCanBeReplaced({
          existingBundleSha256: "old",
          nextBundleSha256: "new",
          publishStatus,
          appId: "peiwang.notes",
          version: "0.1.0",
        }),
      ).not.toThrow();
    }
  });

  it("keeps a published version immutable", () => {
    expect(() =>
      assertAppVersionCanBeReplaced({
        existingBundleSha256: "old",
        nextBundleSha256: "new",
        publishStatus: "published",
        appId: "peiwang.notes",
        version: "0.1.0",
      }),
    ).toThrow("app version is immutable");
  });
});

describe("D1MarketplaceAppDataSource artifact gate", () => {
  it("rejects an invalid artifact before writing R2 or D1", async () => {
    const run = vi.fn();
    const statement = {
      bind: vi.fn(),
      first: vi.fn().mockResolvedValue(null),
      run,
    };
    statement.bind.mockReturnValue(statement);
    const put = vi.fn();
    const dataSource = new D1MarketplaceAppDataSource(
      { prepare: vi.fn().mockReturnValue(statement) } as never,
      { put } as never,
    );

    await expect(
      dataSource.publishApp(
        {
          slug: "notes",
          appId: "peiwang.notes",
          name: "Notes",
          version: "0.1.0",
          summary: "Notes",
          summaryI18n: { en: "Notes" },
          author: "peiwang",
          tags: ["notes"],
          featured: false,
          publisher: { id: "peiwang", name: "peiwang" },
          manifest: {
            schemaVersion: 2,
            id: "peiwang.notes",
            name: "Notes",
            version: "0.1.0",
            components: [{ kind: "panel", path: "panels/notes.panel" }],
          },
          permissions: {},
          distributionMode: "bundle",
          bundleBase64: "bm90LXppcA==",
          bundleSha256: "0".repeat(64),
          files: [{ path: "marketplace.json", contentBase64: "e30=" }],
        },
        personalActor,
      ),
    ).rejects.toThrow("invalid app bundle");

    expect(put).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });
});
