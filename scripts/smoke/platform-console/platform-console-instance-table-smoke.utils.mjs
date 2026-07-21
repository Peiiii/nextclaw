import process from "node:process";
export async function assertInstanceTableFlow(page) {
  const actionsHeader = page.getByRole("columnheader", { name: "Actions" });
  const stickyStyle = await actionsHeader.evaluate((element) => ({
    position: window.getComputedStyle(element).position,
    right: window.getComputedStyle(element).right,
  }));
  if (stickyStyle.position !== "sticky" || stickyStyle.right !== "0px") {
    throw new Error(
      `Instance action column is not fixed: ${JSON.stringify(stickyStyle)}`,
    );
  }

  await page.getByRole("button", { name: "Next" }).click();
  await page.waitForFunction(() =>
    document.body.innerText.includes("11–12 of 12"),
  );
  await page
    .getByRole("button", { name: "Copy instance ID: inst-12", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Previous" }).click();
  await page.getByRole("button", { name: "Archived", exact: true }).click();
  await page
    .getByRole("button", { name: "Copy instance ID: archived-1", exact: true })
    .waitFor();
  const archivedRows = await page.getByRole("table").getByRole("row").count();
  if (archivedRows !== 2) {
    throw new Error(
      `Archived filter should render one table row, found ${archivedRows - 1}.`,
    );
  }
  await page.getByRole("button", { name: "Current", exact: true }).click();
  await page
    .getByPlaceholder("Search name, ID, domain, port, platform, or version")
    .fill("Linux Runner 12");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page
    .getByRole("button", { name: "Copy instance ID: inst-12", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Reset" }).click();
  await page.waitForFunction(() =>
    document.body.innerText.includes("1–10 of 12"),
  );
}

export async function assertInstanceTableResponsiveLayout(page) {
  const mobileWidth = Number(process.env.PLATFORM_MOBILE_WIDTH ?? 390);
  await page.setViewportSize({ width: mobileWidth, height: 844 });
  await page.getByTestId("remote-instance-mobile-card").first().waitFor();
  const mobileLayout = await readMobileInstanceLayout(page);
  assertMobileInstanceLayout(mobileLayout);
  await assertMobileInstanceActions(page);
  await assertMobilePreferences(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("columnheader", { name: "Actions" }).waitFor();
}

async function readMobileInstanceLayout(page) {
  return await page.evaluate(() => {
    const scrollRegion = document.querySelector(
      '[data-testid="console-scroll-region"]',
    );
    const mobileList = document.querySelector(
      '[data-testid="data-table-mobile-list"]',
    );
    const desktopTable = document.querySelector("table");
    const header = document.querySelector(
      '[data-testid="console-mobile-header"]',
    );
    const navigation = document.querySelector(
      '[data-testid="console-mobile-navigation"]',
    );
    const firstCard = document.querySelector(
      '[data-testid="remote-instance-mobile-card"]',
    );
    if (
      !(scrollRegion instanceof HTMLElement) ||
      !(mobileList instanceof HTMLElement) ||
      !(desktopTable instanceof HTMLElement) ||
      !(header instanceof HTMLElement) ||
      !(navigation instanceof HTMLElement) ||
      !(firstCard instanceof HTMLElement)
    ) {
      throw new Error(
        "Mobile instance layout is missing its shell, navigation, list, card, or desktop table.",
      );
    }
    const headerBounds = header.getBoundingClientRect();
    const navigationBounds = navigation.getBoundingClientRect();
    const scrollBounds = scrollRegion.getBoundingClientRect();
    const firstCardBounds = firstCard.getBoundingClientRect();
    const nestedScrollOwners = [...document.querySelectorAll("*")]
      .filter(
        (element) =>
          element instanceof HTMLElement &&
          element !== scrollRegion &&
          element.offsetParent !== null,
      )
      .filter((element) => {
        const overflowY = window.getComputedStyle(element).overflowY;
        return (
          (overflowY === "auto" || overflowY === "scroll") &&
          element.scrollHeight > element.clientHeight + 1
        );
      })
      .map(
        (element) =>
          element.getAttribute("data-testid") ?? element.tagName.toLowerCase(),
      );
    const before = scrollRegion.scrollTop;
    scrollRegion.scrollTop = scrollRegion.scrollHeight;
    const after = scrollRegion.scrollTop;
    const distanceFromBottom =
      scrollRegion.scrollHeight - scrollRegion.clientHeight - after;
    scrollRegion.scrollTop = before;
    return {
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      scrollClientHeight: scrollRegion.clientHeight,
      scrollHeight: scrollRegion.scrollHeight,
      scrolledTo: after,
      distanceFromBottom,
      headerHeight: headerBounds.height,
      navigationHeight: navigationBounds.height,
      navigationClientWidth: navigation.clientWidth,
      navigationScrollWidth: navigation.scrollWidth,
      firstCardTop: firstCardBounds.top,
      firstCardBottom: firstCardBounds.bottom,
      scrollRegionBottom: scrollBounds.bottom,
      nestedScrollOwners,
      mobileListDisplay: window.getComputedStyle(mobileList).display,
      desktopTableDisplay: window.getComputedStyle(desktopTable.closest("div"))
        .display,
    };
  });
}

function assertMobileInstanceLayout(mobileLayout) {
  if (
    mobileLayout.documentScrollWidth > mobileLayout.documentClientWidth ||
    mobileLayout.bodyScrollWidth > mobileLayout.documentClientWidth
  ) {
    throw new Error(
      `Mobile console has horizontal page overflow: ${JSON.stringify(mobileLayout)}`,
    );
  }
  if (
    mobileLayout.scrollHeight <= mobileLayout.scrollClientHeight ||
    mobileLayout.scrolledTo <= 0 ||
    mobileLayout.distanceFromBottom > 2
  ) {
    throw new Error(
      `Mobile console content is not vertically reachable: ${JSON.stringify(mobileLayout)}`,
    );
  }
  if (
    mobileLayout.mobileListDisplay === "none" ||
    mobileLayout.desktopTableDisplay !== "none"
  ) {
    throw new Error(
      `Mobile console did not switch from desktop table to task cards: ${JSON.stringify(mobileLayout)}`,
    );
  }
  if (
    mobileLayout.documentScrollHeight > mobileLayout.viewportHeight + 1 ||
    mobileLayout.nestedScrollOwners.length > 0
  ) {
    throw new Error(
      `Mobile console has more than one primary scroll surface: ${JSON.stringify(mobileLayout)}`,
    );
  }
  if (
    mobileLayout.headerHeight > 56 ||
    mobileLayout.navigationHeight > 64 ||
    mobileLayout.navigationScrollWidth > mobileLayout.navigationClientWidth
  ) {
    throw new Error(
      `Mobile console chrome is oversized or horizontally scrollable: ${JSON.stringify(mobileLayout)}`,
    );
  }
  if (
    mobileLayout.firstCardTop > 260 ||
    mobileLayout.firstCardBottom > mobileLayout.scrollRegionBottom
  ) {
    throw new Error(
      `Mobile console does not show the first complete task card in the initial viewport: ${JSON.stringify(mobileLayout)}`,
    );
  }
}

async function assertMobileInstanceActions(page) {
  const firstCard = page.getByTestId("remote-instance-mobile-card").first();
  await firstCard.getByRole("button", { name: "Open", exact: true }).waitFor();
  await firstCard
    .getByRole("button", { name: "Shares", exact: true })
    .waitFor();
  await firstCard
    .getByRole("button", { name: "Archive", exact: true })
    .waitFor();
}

async function assertMobilePreferences(page) {
  const mobilePreferences = page.locator("details");
  await mobilePreferences.locator("summary").click();
  await mobilePreferences.getByText("Language", { exact: true }).waitFor();
  await mobilePreferences.getByText("Theme", { exact: true }).waitFor();
  if (process.env.PLATFORM_CONSOLE_MOBILE_MENU_SCREENSHOT_PATH) {
    await page.screenshot({
      path: process.env.PLATFORM_CONSOLE_MOBILE_MENU_SCREENSHOT_PATH,
    });
  }
  await mobilePreferences.locator("summary").click();
  if (process.env.PLATFORM_CONSOLE_MOBILE_SCREENSHOT_PATH) {
    await page.screenshot({
      path: process.env.PLATFORM_CONSOLE_MOBILE_SCREENSHOT_PATH,
    });
  }
}

export async function assertRemoteOpenActions(page, baseUrl) {
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Open", exact: true }).first().click();
  await page.waitForFunction(
    () => Array.isArray(window.__openedUrls) && window.__openedUrls.length >= 1,
  );
  const openedInstanceDomainUrl = await page.evaluate(
    () => window.__openedUrls[0],
  );
  if (
    openedInstanceDomainUrl !==
    "https://instance-1.claw.cool/platform/remote/open?token=token-1"
  ) {
    throw new Error(
      `Stable instance-domain open action used unexpected URL: ${openedInstanceDomainUrl}`,
    );
  }
}

export async function assertRemoteDomainEditing(page, baseUrl) {
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  const unconfiguredRow = page.getByRole("row").filter({
    has: page.getByRole("button", {
      name: "Copy instance ID: inst-2",
      exact: true,
    }),
  });
  await unconfiguredRow
    .getByRole("button", { name: "Set domain", exact: true })
    .click();
  await unconfiguredRow
    .getByRole("textbox", { name: "Custom domain prefix" })
    .fill("desk-two");
  await unconfiguredRow
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await unconfiguredRow
    .getByText("desk-two.claw.cool", { exact: true })
    .waitFor();
  await unconfiguredRow
    .getByText("i-system-2.claw.cool", { exact: true })
    .waitFor();

  const firstRow = page.getByRole("row").filter({
    has: page.getByRole("button", {
      name: "Copy instance ID: inst-1",
      exact: true,
    }),
  });
  await firstRow
    .getByRole("button", { name: "Edit domain", exact: true })
    .click();
  await firstRow
    .getByRole("textbox", { name: "Custom domain prefix" })
    .fill("desk-one");
  await firstRow.getByRole("button", { name: "Save", exact: true }).click();
  await firstRow.getByText("desk-one.claw.cool", { exact: true }).waitFor();
  await page
    .getByText("Custom domain updated. The default domain remains available.", {
      exact: true,
    })
    .waitFor();
  await firstRow.getByText("i-system-1.claw.cool", { exact: true }).waitFor();

  await firstRow
    .getByRole("button", { name: "Edit domain", exact: true })
    .click();
  await firstRow
    .getByRole("textbox", { name: "Custom domain prefix" })
    .fill("remote");
  await firstRow.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .getByText("This prefix is reserved by the platform. Choose another one.", {
      exact: true,
    })
    .waitFor();

  await firstRow.getByRole("button", { name: "Cancel", exact: true }).click();
  acceptNextDialog(page);
  await firstRow.getByRole("button", { name: "Remove", exact: true }).click();
  await firstRow.getByText("Not set", { exact: true }).waitFor();
  await firstRow.getByText("i-system-1.claw.cool", { exact: true }).waitFor();
  await page
    .getByText("Custom domain removed. The default domain remains available.", {
      exact: true,
    })
    .waitFor();
}

function acceptNextDialog(page) {
  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
}

export async function assertArchiveLifecycle(page) {
  const activeInstanceRow = () =>
    page.getByRole("row").filter({
      has: page.getByRole("button", {
        name: "Copy instance ID: inst-1",
        exact: true,
      }),
    });
  acceptNextDialog(page);
  await activeInstanceRow()
    .getByRole("button", { name: "Archive", exact: true })
    .click();
  await page.waitForFunction(() =>
    document.body.innerText.includes("Instance archived."),
  );
  await page.getByRole("button", { name: "Archived", exact: true }).click();
  const archivedInstanceRow = page
    .getByRole("row")
    .filter({ hasText: "inst-1" });
  await archivedInstanceRow.getByRole("button", { name: "Restore" }).click();
  await page.waitForFunction(() =>
    document.body.innerText.includes("Instance restored."),
  );
  await page.getByRole("button", { name: "Current", exact: true }).click();
  acceptNextDialog(page);
  await activeInstanceRow()
    .getByRole("button", { name: "Archive", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Copy instance ID: inst-1", exact: true })
    .waitFor({ state: "detached" });
  await page.getByRole("button", { name: "Archived", exact: true }).click();
  await page
    .getByRole("button", { name: "Copy instance ID: inst-1", exact: true })
    .waitFor();
  acceptNextDialog(page);
  await page
    .getByRole("row")
    .filter({ hasText: "inst-1" })
    .getByRole("button", { name: "Delete" })
    .click();
  await page.waitForFunction(() =>
    document.body.innerText.includes("Archived instance deleted permanently."),
  );
}
