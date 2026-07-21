import { REMOTE_QUOTA_SUMMARY_FIXTURE } from "./platform-console-quota-smoke.utils.mjs";

function okEnvelope(data) {
  return JSON.stringify({ ok: true, data });
}

async function fulfillJson(route, data) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: okEnvelope(data),
  });
}

export function createRemoteInstanceFixtures() {
  return {
    activeInstances: Array.from({ length: 12 }, (_item, index) => {
      const instanceNumber = index + 1;
      const hour = String(23 - index).padStart(2, "0");
      return {
        id: `inst-${instanceNumber}`,
        instanceInstallId: `install-${instanceNumber}`,
        displayName:
          instanceNumber === 12
            ? "Linux Runner 12"
            : `MacBook Pro ${instanceNumber}`,
        appVersion: `0.13.${100 - instanceNumber}`,
        platform: instanceNumber === 12 ? "linux" : "macOS",
        localOrigin: `http://127.0.0.1:${55_666 + instanceNumber}`,
        systemDomainPrefix: `i-system-${instanceNumber}`,
        systemDomain: `i-system-${instanceNumber}.claw.cool`,
        systemDomainClaimedAt: "2026-03-22T00:00:00.000Z",
        customDomainPrefix:
          instanceNumber === 2 ? null : `instance-${instanceNumber}`,
        customDomain:
          instanceNumber === 2 ? null : `instance-${instanceNumber}.claw.cool`,
        customDomainClaimedAt:
          instanceNumber === 2 ? null : "2026-03-22T00:00:00.000Z",
        customDomainExpiresAt: null,
        status: instanceNumber % 2 === 1 ? "online" : "offline",
        lastSeenAt: `2026-03-23T${hour}:00:00.000Z`,
        archivedAt: null,
        createdAt: `2026-03-22T${hour}:00:00.000Z`,
        updatedAt: `2026-03-23T${hour}:00:00.000Z`,
      };
    }),
    archivedInstances: [
      {
        id: "archived-1",
        instanceInstallId: "archived-install-1",
        displayName: "Archived Mac mini",
        appVersion: "0.12.1",
        platform: "macOS",
        localOrigin: "http://127.0.0.1:55680",
        systemDomainPrefix: "i-system-archived-mini",
        systemDomain: "i-system-archived-mini.claw.cool",
        systemDomainClaimedAt: "2026-02-01T09:00:00.000Z",
        customDomainPrefix: "archived-mini",
        customDomain: "archived-mini.claw.cool",
        customDomainClaimedAt: "2026-02-01T09:00:00.000Z",
        customDomainExpiresAt: null,
        status: "offline",
        lastSeenAt: "2026-03-01T09:00:00.000Z",
        archivedAt: "2026-03-02T09:00:00.000Z",
        createdAt: "2026-02-01T09:00:00.000Z",
        updatedAt: "2026-03-02T09:00:00.000Z",
      },
    ],
  };
}

async function installInstanceListRoute(page, fixtures) {
  await page.route("**/platform/remote/instances**", async (route) => {
    const url = new URL(route.request().url());
    const archiveStatus = url.searchParams.get("archiveStatus") ?? "active";
    const connectionStatus = url.searchParams.get("connectionStatus") ?? "all";
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const pageNumber = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("pageSize") ?? "10");
    const sortBy = url.searchParams.get("sortBy") ?? "lastSeenAt";
    const sortDirection =
      url.searchParams.get("sortDirection") === "asc" ? 1 : -1;
    const source =
      archiveStatus === "archived"
        ? fixtures.archivedInstances
        : archiveStatus === "all"
          ? [...fixtures.activeInstances, ...fixtures.archivedInstances]
          : fixtures.activeInstances;
    const filtered = source
      .filter(
        (instance) =>
          connectionStatus === "all" || instance.status === connectionStatus,
      )
      .filter((instance) =>
        [
          instance.displayName,
          instance.id,
          instance.instanceInstallId,
          instance.platform,
          instance.appVersion,
          instance.localOrigin,
          instance.systemDomain,
          instance.customDomain,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q),
      )
      .sort(
        (left, right) =>
          String(left[sortBy] ?? "").localeCompare(
            String(right[sortBy] ?? ""),
          ) * sortDirection,
      );
    const offset = (pageNumber - 1) * pageSize;
    await fulfillJson(route, {
      archiveStatus,
      connectionStatus,
      q,
      page: pageNumber,
      pageSize,
      sortBy,
      sortDirection: sortDirection === 1 ? "asc" : "desc",
      total: filtered.length,
      totalPages:
        filtered.length === 0 ? 0 : Math.ceil(filtered.length / pageSize),
      items: filtered.slice(offset, offset + pageSize),
    });
  });
}

async function installInstanceLifecycleRoutes(page, fixtures) {
  await page.route(
    "**/platform/remote/instances/inst-1/archive",
    async (route) => {
      const activeIndex = fixtures.activeInstances.findIndex(
        (instance) => instance.id === "inst-1",
      );
      const archived = {
        ...fixtures.activeInstances[activeIndex],
        archivedAt: "2026-03-23T10:00:00.000Z",
        updatedAt: "2026-03-23T10:00:00.000Z",
      };
      fixtures.activeInstances.splice(activeIndex, 1);
      fixtures.archivedInstances.unshift(archived);
      await fulfillJson(route, { instance: archived });
    },
  );
  await page.route(
    "**/platform/remote/instances/inst-1/unarchive",
    async (route) => {
      const archivedIndex = fixtures.archivedInstances.findIndex(
        (instance) => instance.id === "inst-1",
      );
      const restored = {
        ...fixtures.archivedInstances[archivedIndex],
        archivedAt: null,
        updatedAt: "2026-03-23T10:05:00.000Z",
      };
      fixtures.archivedInstances.splice(archivedIndex, 1);
      fixtures.activeInstances.unshift(restored);
      await fulfillJson(route, { instance: restored });
    },
  );
  await page.route(
    "**/platform/remote/instances/inst-1/delete",
    async (route) => {
      const archivedIndex = fixtures.archivedInstances.findIndex(
        (instance) => instance.id === "inst-1",
      );
      fixtures.archivedInstances.splice(archivedIndex, 1);
      await fulfillJson(route, { deleted: true, instanceId: "inst-1" });
    },
  );
}

async function installInstanceAccessRoutes(page) {
  await page.route("**/platform/remote/quota/v2", async (route) => {
    await fulfillJson(route, REMOTE_QUOTA_SUMMARY_FIXTURE);
  });
  await page.route(
    "**/platform/remote/instances/inst-1/shares",
    async (route) => {
      if (route.request().method() === "GET") {
        await fulfillJson(route, { items: [] });
        return;
      }
      await fulfillJson(route, {
        id: "grant-1",
        instanceId: "inst-1",
        status: "active",
        createdAt: "2026-03-23T09:00:00.000Z",
        expiresAt: "2026-03-24T09:00:00.000Z",
        shareUrl: "https://r-demo.claw.cool",
        activeSessionCount: 0,
      });
    },
  );
  await page.route(
    "**/platform/remote/instances/inst-1/open",
    async (route) => {
      await fulfillJson(route, {
        id: "session-1",
        instanceId: "inst-1",
        status: "active",
        sourceType: "owner_open",
        sourceGrantId: null,
        expiresAt: "2026-03-23T10:00:00.000Z",
        lastUsedAt: "2026-03-23T09:00:00.000Z",
        revokedAt: null,
        createdAt: "2026-03-23T09:00:00.000Z",
        openUrl:
          "https://r-session-1.claw.cool/platform/remote/open?token=token-1",
        fixedDomainOpenUrl:
          "https://remote.claw.cool/platform/remote/open?token=token-1",
        systemDomainOpenUrl:
          "https://i-system-1.claw.cool/platform/remote/open?token=token-1",
        customDomainOpenUrl:
          "https://instance-1.claw.cool/platform/remote/open?token=token-1",
      });
    },
  );
}

async function installInstanceDomainRoute(page, fixtures) {
  await page.route("**/platform/remote/instances/*/domain", async (route) => {
    const instanceId = new URL(route.request().url()).pathname
      .split("/")
      .at(-2);
    const instance = [
      ...fixtures.activeInstances,
      ...fixtures.archivedInstances,
    ].find((item) => item.id === instanceId);
    if (route.request().method() === "DELETE") {
      instance.customDomainPrefix = null;
      instance.customDomain = null;
      instance.customDomainClaimedAt = null;
      instance.customDomainExpiresAt = null;
      await fulfillJson(route, { instance });
      return;
    }
    const prefix = String(route.request().postDataJSON()?.prefix ?? "")
      .trim()
      .toLowerCase();
    if (prefix === "remote") {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: {
            code: "REMOTE_DOMAIN_RESERVED",
            message: "This remote domain name is reserved.",
          },
        }),
      });
      return;
    }
    instance.customDomainPrefix = prefix;
    instance.customDomain = `${prefix}.claw.cool`;
    instance.customDomainClaimedAt = "2026-03-23T09:30:00.000Z";
    await fulfillJson(route, { instance });
  });
}

export async function installRemoteInstanceRoutes(page, fixtures) {
  await installInstanceListRoute(page, fixtures);
  await installInstanceLifecycleRoutes(page, fixtures);
  await installInstanceAccessRoutes(page);
  await installInstanceDomainRoute(page, fixtures);
}
