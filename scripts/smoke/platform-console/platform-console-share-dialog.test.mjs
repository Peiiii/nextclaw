import { assertRemoteOpenActions } from "./platform-console-instance-table-smoke.utils.mjs";

export async function assertRemoteAccessActions(page, baseUrl) {
  await assertRemoteOpenActions(page, baseUrl);
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  const firstRow = page.getByRole("row").filter({
    has: page.getByRole("button", {
      name: "Copy instance ID: inst-1",
      exact: true,
    }),
  });
  const desktopShareButton = firstRow.getByRole("button", {
    name: "Shares",
    exact: true,
  });
  await desktopShareButton.click();
  await assertShareSurfaceInViewport(page);
  await page
    .getByRole("button", { name: "Collapse", exact: true })
    .click();
  await page
    .getByText("Share links", { exact: true })
    .waitFor({ state: "detached" });
  const restoredFocus = await page.evaluate(
    () => document.activeElement?.textContent?.trim() ?? null,
  );
  if (restoredFocus !== "Shares") {
    throw new Error(
      `Closing the share dialog did not restore trigger focus: ${restoredFocus}`,
    );
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileCard = page.getByTestId("remote-instance-mobile-card").filter({
    has: page.getByRole("button", {
      name: "Copy instance ID: inst-1",
      exact: true,
    }),
  });
  await mobileCard
    .getByRole("button", { name: "Shares", exact: true })
    .click();
  await assertShareSurfaceInViewport(page);
  await page.keyboard.press("Escape");
  await page
    .getByText("Share links", { exact: true })
    .waitFor({ state: "detached" });
  await page.setViewportSize({ width: 1440, height: 900 });
}

async function assertShareSurfaceInViewport(page) {
  const dialog = page.getByRole("dialog", {
    name: "Share links",
    exact: true,
  });
  await dialog.waitFor();
  const layout = await dialog.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      bottom: bounds.bottom,
      top: bounds.top,
      viewportHeight: window.innerHeight,
    };
  });
  if (layout.bottom <= 0 || layout.top >= layout.viewportHeight) {
    throw new Error(
      `Share surface is outside the current viewport: ${JSON.stringify(layout)}`,
    );
  }
}
