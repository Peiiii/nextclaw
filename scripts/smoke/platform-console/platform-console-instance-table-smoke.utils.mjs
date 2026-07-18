import process from "node:process";
import { REMOTE_QUOTA_SUMMARY_FIXTURE } from "./platform-console-quota-smoke.utils.mjs";

function okEnvelope(data) {
  return JSON.stringify({ ok: true, data });
}

async function fulfillJson(route, data) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: okEnvelope(data)
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
        displayName: instanceNumber === 12 ? "Linux Runner 12" : `MacBook Pro ${instanceNumber}`,
        appVersion: `0.13.${100 - instanceNumber}`,
        platform: instanceNumber === 12 ? "linux" : "macOS",
        status: instanceNumber % 2 === 1 ? "online" : "offline",
        lastSeenAt: `2026-03-23T${hour}:00:00.000Z`,
        archivedAt: null,
        createdAt: `2026-03-22T${hour}:00:00.000Z`,
        updatedAt: `2026-03-23T${hour}:00:00.000Z`
      };
    }),
    archivedInstances: [
      {
        id: "archived-1",
        instanceInstallId: "archived-install-1",
        displayName: "Archived Mac mini",
        appVersion: "0.12.1",
        platform: "macOS",
        status: "offline",
        lastSeenAt: "2026-03-01T09:00:00.000Z",
        archivedAt: "2026-03-02T09:00:00.000Z",
        createdAt: "2026-02-01T09:00:00.000Z",
        updatedAt: "2026-03-02T09:00:00.000Z"
      }
    ]
  };
}

export async function installRemoteInstanceRoutes(page, fixtures) {
  await page.route("**/platform/remote/instances**", async (route) => {
    const url = new URL(route.request().url());
    const archiveStatus = url.searchParams.get("archiveStatus") ?? "active";
    const connectionStatus = url.searchParams.get("connectionStatus") ?? "all";
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const pageNumber = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("pageSize") ?? "10");
    const sortBy = url.searchParams.get("sortBy") ?? "lastSeenAt";
    const sortDirection = url.searchParams.get("sortDirection") === "asc" ? 1 : -1;
    const source = archiveStatus === "archived"
      ? fixtures.archivedInstances
      : archiveStatus === "all"
        ? [...fixtures.activeInstances, ...fixtures.archivedInstances]
        : fixtures.activeInstances;
    const filtered = source
      .filter((instance) => connectionStatus === "all" || instance.status === connectionStatus)
      .filter((instance) => !q || [
        instance.displayName,
        instance.id,
        instance.instanceInstallId,
        instance.platform,
        instance.appVersion
      ].join(" ").toLowerCase().includes(q))
      .sort((left, right) => String(left[sortBy] ?? "").localeCompare(String(right[sortBy] ?? "")) * sortDirection);
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
      totalPages: filtered.length === 0 ? 0 : Math.ceil(filtered.length / pageSize),
      items: filtered.slice(offset, offset + pageSize)
    });
  });
  await page.route("**/platform/remote/instances/inst-1/archive", async (route) => {
    const activeIndex = fixtures.activeInstances.findIndex((instance) => instance.id === "inst-1");
    const archived = {
      ...fixtures.activeInstances[activeIndex],
      archivedAt: "2026-03-23T10:00:00.000Z",
      updatedAt: "2026-03-23T10:00:00.000Z"
    };
    fixtures.activeInstances.splice(activeIndex, 1);
    fixtures.archivedInstances.unshift(archived);
    await fulfillJson(route, { instance: archived });
  });
  await page.route("**/platform/remote/instances/inst-1/unarchive", async (route) => {
    const archivedIndex = fixtures.archivedInstances.findIndex((instance) => instance.id === "inst-1");
    const restored = {
      ...fixtures.archivedInstances[archivedIndex],
      archivedAt: null,
      updatedAt: "2026-03-23T10:05:00.000Z"
    };
    fixtures.archivedInstances.splice(archivedIndex, 1);
    fixtures.activeInstances.unshift(restored);
    await fulfillJson(route, { instance: restored });
  });
  await page.route("**/platform/remote/instances/inst-1/delete", async (route) => {
    const archivedIndex = fixtures.archivedInstances.findIndex((instance) => instance.id === "inst-1");
    fixtures.archivedInstances.splice(archivedIndex, 1);
    await fulfillJson(route, { deleted: true, instanceId: "inst-1" });
  });
  await page.route("**/platform/remote/quota/v2", async (route) => {
    await fulfillJson(route, REMOTE_QUOTA_SUMMARY_FIXTURE);
  });
  await page.route("**/platform/remote/instances/inst-1/shares", async (route) => {
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
      activeSessionCount: 0
    });
  });
  await page.route("**/platform/remote/instances/inst-1/open", async (route) => {
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
      openUrl: "https://r-session-1.claw.cool/platform/remote/open?token=token-1",
      fixedDomainOpenUrl: "https://remote.claw.cool/platform/remote/open?token=token-1"
    });
  });
}

export async function assertInstanceTableFlow(page) {
  const actionsHeader = page.getByRole("columnheader", { name: "Actions" });
  const stickyStyle = await actionsHeader.evaluate((element) => ({
    position: getComputedStyle(element).position,
    right: getComputedStyle(element).right
  }));
  if (stickyStyle.position !== "sticky" || stickyStyle.right !== "0px") {
    throw new Error(`Instance action column is not fixed: ${JSON.stringify(stickyStyle)}`);
  }

  await page.getByRole("button", { name: "Next" }).click();
  await page.waitForFunction(() => document.body.innerText.includes("11–12 of 12"));
  await page.getByRole("button", { name: "Copy instance ID: inst-12", exact: true }).waitFor();
  await page.getByRole("button", { name: "Previous" }).click();
  await page.getByRole("button", { name: "Archived", exact: true }).click();
  await page.getByRole("button", { name: "Copy instance ID: archived-1", exact: true }).waitFor();
  const archivedRows = await page.getByRole("table").getByRole("row").count();
  if (archivedRows !== 2) {
    throw new Error(`Archived filter should render one table row, found ${archivedRows - 1}.`);
  }
  await page.getByRole("button", { name: "Current", exact: true }).click();
  await page.getByPlaceholder("Search name, ID, platform, or version").fill("Linux Runner 12");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("button", { name: "Copy instance ID: inst-12", exact: true }).waitFor();
  await page.getByRole("button", { name: "Reset" }).click();
  await page.waitForFunction(() => document.body.innerText.includes("1–10 of 12"));
}

export async function assertInstanceTableResponsiveLayout(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("remote-instance-mobile-card").first().waitFor();

  const mobileLayout = await page.evaluate(() => {
    const scrollRegion = document.querySelector('[data-testid="console-scroll-region"]');
    const mobileList = document.querySelector('[data-testid="data-table-mobile-list"]');
    const desktopTable = document.querySelector("table");
    if (!(scrollRegion instanceof HTMLElement) || !(mobileList instanceof HTMLElement) || !(desktopTable instanceof HTMLElement)) {
      throw new Error("Mobile instance layout is missing its scroll region, card list, or desktop table.");
    }
    const before = scrollRegion.scrollTop;
    scrollRegion.scrollTop = scrollRegion.scrollHeight;
    const after = scrollRegion.scrollTop;
    const distanceFromBottom = scrollRegion.scrollHeight - scrollRegion.clientHeight - after;
    scrollRegion.scrollTop = before;
    return {
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      scrollClientHeight: scrollRegion.clientHeight,
      scrollHeight: scrollRegion.scrollHeight,
      scrolledTo: after,
      distanceFromBottom,
      mobileListDisplay: getComputedStyle(mobileList).display,
      desktopTableDisplay: getComputedStyle(desktopTable.closest("div")).display
    };
  });
  if (mobileLayout.documentScrollWidth > mobileLayout.documentClientWidth || mobileLayout.bodyScrollWidth > mobileLayout.documentClientWidth) {
    throw new Error(`Mobile console has horizontal page overflow: ${JSON.stringify(mobileLayout)}`);
  }
  if (mobileLayout.scrollHeight <= mobileLayout.scrollClientHeight || mobileLayout.scrolledTo <= 0 || mobileLayout.distanceFromBottom > 2) {
    throw new Error(`Mobile console content is not vertically reachable: ${JSON.stringify(mobileLayout)}`);
  }
  if (mobileLayout.mobileListDisplay === "none" || mobileLayout.desktopTableDisplay !== "none") {
    throw new Error(`Mobile console did not switch from desktop table to task cards: ${JSON.stringify(mobileLayout)}`);
  }

  const firstCard = page.getByTestId("remote-instance-mobile-card").first();
  await firstCard.getByRole("button", { name: "Open", exact: true }).waitFor();
  await firstCard.getByRole("button", { name: "Fixed domain", exact: true }).waitFor();
  await firstCard.getByRole("button", { name: "Shares", exact: true }).waitFor();
  await firstCard.getByRole("button", { name: "Archive", exact: true }).waitFor();

  const mobilePreferences = page.locator("details");
  await mobilePreferences.locator("summary").click();
  await mobilePreferences.getByText("Language", { exact: true }).waitFor();
  await mobilePreferences.getByText("Theme", { exact: true }).waitFor();
  await mobilePreferences.locator("summary").click();
  if (process.env.PLATFORM_CONSOLE_MOBILE_SCREENSHOT_PATH) {
    await page.screenshot({ path: process.env.PLATFORM_CONSOLE_MOBILE_SCREENSHOT_PATH });
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("columnheader", { name: "Actions" }).waitFor();
}

export async function assertRemoteOpenActions(page, baseUrl) {
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Open", exact: true }).first().click();
  await page.waitForFunction(() => Array.isArray(window.__openedUrls) && window.__openedUrls.length >= 1);
  const openedSubdomainUrl = await page.evaluate(() => window.__openedUrls[0]);
  if (openedSubdomainUrl !== "https://r-session-1.claw.cool/platform/remote/open?token=token-1") {
    throw new Error(`Subdomain open action used unexpected URL: ${openedSubdomainUrl}`);
  }
  await page.getByRole("button", { name: "Fixed domain", exact: true }).first().click();
  await page.waitForFunction(() => Array.isArray(window.__openedUrls) && window.__openedUrls.length >= 2);
  const openedFixedDomainUrl = await page.evaluate(() => window.__openedUrls[1]);
  if (openedFixedDomainUrl !== "https://remote.claw.cool/platform/remote/open?token=token-1") {
    throw new Error(`Fixed-domain open action used unexpected URL: ${openedFixedDomainUrl}`);
  }
}

function acceptNextDialog(page) {
  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
}

export async function assertArchiveLifecycle(page) {
  const activeInstanceRow = () => page.getByRole("row").filter({
    has: page.getByRole("button", { name: "Copy instance ID: inst-1", exact: true })
  });
  acceptNextDialog(page);
  await activeInstanceRow().getByRole("button", { name: "Archive", exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes("Instance archived."));
  await page.getByRole("button", { name: "Archived", exact: true }).click();
  const archivedInstanceRow = page.getByRole("row").filter({ hasText: "inst-1" });
  await archivedInstanceRow.getByRole("button", { name: "Restore" }).click();
  await page.waitForFunction(() => document.body.innerText.includes("Instance restored."));
  await page.getByRole("button", { name: "Current", exact: true }).click();
  acceptNextDialog(page);
  await activeInstanceRow().getByRole("button", { name: "Archive", exact: true }).click();
  await page.getByRole("button", { name: "Copy instance ID: inst-1", exact: true }).waitFor({ state: "detached" });
  await page.getByRole("button", { name: "Archived", exact: true }).click();
  await page.getByRole("button", { name: "Copy instance ID: inst-1", exact: true }).waitFor();
  acceptNextDialog(page);
  await page.getByRole("row").filter({ hasText: "inst-1" }).getByRole("button", { name: "Delete" }).click();
  await page.waitForFunction(() => document.body.innerText.includes("Archived instance deleted permanently."));
}
