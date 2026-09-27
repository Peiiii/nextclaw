import assert from "node:assert/strict";
import type { Page } from "playwright";

export async function checkThemes(page: Page, width: number, base: string): Promise<void> {
  await page.goto(`${base}/chat/session-a`, { waitUntil: "networkidle" });
  const composer = page.getByRole("textbox", { name: /告诉 Bibo/ });
  await composer.fill("主题切换期间保留草稿");
  const message = await page.locator(".ui-message--assistant").first().elementHandle();
  assert.equal(await page.locator("html").getAttribute("data-bibo-theme"), "classic");
  if (width < 760) await page.getByRole("button", { name: "打开菜单" }).click();
  await page.getByRole("button", { name: "账号与帮助" }).click();
  assert.equal(await page.getByRole("menuitemradio", { name: "Bibo 经典" }).getAttribute("aria-checked"), "true");
  await page.getByRole("menuitemradio", { name: "简约", exact: true }).click();
  if (width < 760) {
    await page.getByRole("dialog").evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
  }
  assert.equal(await composer.inputValue(), "主题切换期间保留草稿");
  assert.ok(await message!.evaluate((element) => element.isConnected), "switching themes preserves message nodes");
  assert.equal(await page.locator("html").getAttribute("data-bibo-theme"), "neutral");
  await composer.fill("");
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.locator("html").getAttribute("data-bibo-theme"), "neutral", "theme survives refresh");
  if (width < 760) await page.getByRole("button", { name: "打开菜单" }).click();
  await page.getByRole("button", { name: "账号与帮助" }).click();
  assert.equal(await page.getByRole("menuitemradio", { name: "简约", exact: true }).getAttribute("aria-checked"), "true");
  await page.getByRole("menuitemradio", { name: "Bibo 经典" }).click();
  if (width < 760) {
    await page.getByRole("dialog").evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
  }
  assert.equal(await page.locator("html").getAttribute("data-bibo-theme"), "classic");
}

export async function checkControlFeedback(page: Page, width: number, base: string): Promise<void> {
  await page.goto(`${base}/inbox`, { waitUntil: "networkidle" });
  await checkNavigationFeedback(page, width);
  const row = page.locator(".inbox-layout .ui-list-row").first();
  await row.hover();
  await page.waitForTimeout(450);
  assert.equal(await page.getByRole("tooltip").count(), 0, "content rows do not repeat their title in tooltips");
  assert.equal(await row.evaluate((element) => getComputedStyle(element).borderRadius), "8px");
  await row.click();
  const action = page.getByRole("button", { name: "标记已读", exact: true });
  const coarse = await page.evaluate(() => matchMedia("(pointer: coarse)").matches);
  assert.equal(await action.evaluate((element) => element.getBoundingClientRect().height), coarse ? 44 : 32);
  await action.hover();
  await page.waitForTimeout(450);
  assert.equal(await page.getByRole("tooltip").count(), 0, "visible action labels do not need repeated hints");
  await page.goto(`${base}/tasks`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "今天", exact: true }).hover();
  await page.waitForTimeout(450);
  assert.equal(await page.getByRole("tooltip").count(), 0, "readable filters do not need repeated hints");
  await page.getByRole("button", { name: "筛选与视图", exact: true }).hover();
  const hint = page.getByRole("tooltip", { name: "筛选与视图", exact: true });
  await hint.waitFor();
  const box = await hint.boundingBox();
  assert.ok(box && box.x >= 0 && box.x + box.width <= width, "tooltips avoid viewport edges");
  await page.mouse.move(width - 20, 250);
  await hint.waitFor({ state: "hidden" });
}

async function checkNavigationFeedback(page: Page, width: number): Promise<void> {
  const iconShapes = await page.locator(".ui-icon-button:visible").evaluateAll((elements) => elements.map((element) => {
    const box = element.getBoundingClientRect();
    return { label: element.getAttribute("aria-label"), width: box.width, height: box.height };
  }));
  assert.ok(iconShapes.every((box) => Math.abs(box.width - box.height) < .5), JSON.stringify(iconShapes));
  if (width > 760) {
    const taskEntry = page.getByRole("navigation", { name: "工作空间" }).getByRole("link", { name: "任务", exact: true });
    await taskEntry.hover();
    assert.equal(await taskEntry.evaluate((element) => getComputedStyle(element, "::before").backgroundColor === getComputedStyle(element.closest(".bibo-navigation-rail")!).backgroundColor), false, "navigation hover must differ from the rail background");
    const entry = page.getByRole("navigation", { name: "工作空间" }).getByRole("link", { name: "收件箱", exact: true });
    await entry.hover();
    const hint = page.getByRole("tooltip", { name: "收件箱", exact: true });
    await hint.waitFor();
    assert.equal(await hint.evaluate((element) => element.closest(".ui-tooltip")?.getAttribute("data-side")), "right");
    await page.mouse.move(width - 20, 100);
    await hint.waitFor({ state: "hidden" });
  } else {
    const feedback = await page.locator(".bibo-mobile-nav .is-active").evaluate((element) => {
      const s = getComputedStyle(element, "::before");
      return { background: getComputedStyle(element).backgroundColor, width: parseFloat(s.width), radius: s.borderRadius };
    });
    assert.equal(feedback.background, "rgba(0, 0, 0, 0)", "selection does not fill the whole navigation slot");
    assert.ok(feedback.width <= 56 && feedback.width > 30);
    assert.equal(feedback.radius, "10px");
  }
}

export async function checkFileTabs(page: Page): Promise<void> {
  for (let index = 0; index < 10; index++) {
    const back = page.locator(".file-mobile-back button");
    if (await back.isVisible()) await back.click();
    await page.getByRole("treeitem", { name: `review-document-${index}.md`, exact: true }).click();
    await page.getByRole("textbox", { name: `编辑 review-document-${index}.md` }).waitFor();
  }
  await page.waitForFunction(() => {
    const tab = document.querySelector(".bibo-file-tab.is-active")!;
    return tab.getBoundingClientRect().right <= tab.parentElement!.getBoundingClientRect().right + 1;
  });
  const editor = page.getByRole("textbox", { name: "编辑 review-document-9.md" });
  await editor.fill("未保存的文件草稿");
  await page.getByRole("tab", { name: /^review-document-9\.md/ }).focus();
  const firstTabId = await page.getByRole("tab").first().getAttribute("id");
  await page.keyboard.press("Home");
  assert.equal(await editor.inputValue(), "未保存的文件草稿", "moving tab focus does not activate another file");
  await page.keyboard.press("Enter");
  await page.waitForFunction((id) => document.getElementById(id!)?.getAttribute("aria-selected") === "true", firstTabId);
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await editor.waitFor();
  assert.equal(await editor.inputValue(), "未保存的文件草稿");
}
