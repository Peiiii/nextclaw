import { openMarkdownSource } from "../personal-workspace.fixture";
import assert from "node:assert/strict";
import type { Locator, Page } from "playwright";

export async function checkLayoutInitialization(page: Page, base: string): Promise<void> {
  await page.goto(base, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "收起侧边栏", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".bibo-sidebar")!.getBoundingClientRect().width < 100);
  await page.locator(".bibo-sidebar").evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)));
  const width = await page.locator(".bibo-sidebar").evaluate((element) => element.getBoundingClientRect().width);
  let releaseAccount!: () => void;
  const accountGate = new Promise<void>((resolve) => { releaseAccount = resolve; });
  await page.route("**/api/auth/me", async (route) => { await accountGate; await route.fallback(); });
  await page.addInitScript(() => {
    (window as unknown as { layoutTransitions: string[] }).layoutTransitions = [];
    document.addEventListener("transitionrun", (event) => {
      if ((event.target as Element).matches(".bibo-sidebar, .bibo-sidebar-panel, .bibo-workspace, .bibo-main"))
        (window as unknown as { layoutTransitions: string[] }).layoutTransitions.push((event.target as Element).className);
    });
  });
  try {
    await checkSidebarRestoration(page, width, releaseAccount);
    await checkResponsiveLayoutPreference(page, base);
  } finally { releaseAccount(); await page.unroute("**/api/auth/me"); }
}

async function checkSidebarRestoration(page: Page, width: number, releaseAccount: () => void): Promise<void> {
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".bibo-shell").waitFor();
  assert.equal(await page.locator(".bibo-sidebar").evaluate((element) => element.getBoundingClientRect().width), width,
    "first paint restores the collapsed sidebar before the account response");
  releaseAccount();
  await page.getByRole("button", { name: "账号与帮助" }).waitFor();
  await page.waitForLoadState("networkidle");
  assert.equal(await page.locator(".bibo-sidebar").evaluate((element) => element.getBoundingClientRect().width), width);
  assert.deepEqual(await page.evaluate(() => (window as unknown as { layoutTransitions: string[] }).layoutTransitions), [],
    "restoring layout must not replay user action transitions");
  await page.screenshot({ path: `/tmp/bibo-layout-initialization-${new URL(page.url()).hostname}.png` });
  const motion = await page.evaluate<number[]>(`(async () => {
    document.querySelector('[aria-label="展开侧边栏"]').click();
    const widths = [];
    const start = performance.now();
    do { await new Promise(requestAnimationFrame); widths.push(document.querySelector('.bibo-sidebar').getBoundingClientRect().width); }
    while (performance.now() - start < 300);
    return widths;
  })()`);
  assert.ok(motion.some((sample) => sample > width + 1 && sample < motion.at(-1)! - 1), "explicit expansion retains intermediate animation frames");
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.getByRole("button", { name: "收起侧边栏", exact: true }).getAttribute("aria-expanded"), "true");
  assert.deepEqual(await page.evaluate(() => (window as unknown as { layoutTransitions: string[] }).layoutTransitions), []);
}

async function checkResponsiveLayoutPreference(page: Page, base: string): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "收起侧边栏", exact: true }).click();
  assert.equal(await page.locator(".bibo-sidebar").evaluate((element) => getComputedStyle(element).transitionDuration), "0s");
  await page.getByRole("button", { name: "展开侧边栏", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(`${base}/files`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "收起目录树", exact: true }).click();
  await page.getByRole("button", { name: "展开目录树", exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.locator(".bibo-file-tree").isVisible(), true, "mobile restores a visible directory even when the desktop preference is collapsed");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "展开目录树", exact: true }).waitFor();
}

export async function checkLongPlanningDetails(page: Page, view: "tasks" | "calendar") {
  await page.locator(view === "tasks" ? ".bibo-task-row" : ".bibo-agenda-event:visible").first().click();
  if (view === "tasks") await page.getByRole("button", { name: "编辑任务", exact: true }).click();
  assert.ok((await page.getByRole("textbox", { name: view === "tasks" ? "任务名称" : "标题", exact: true }).inputValue()).length > 100);
  if (view === "tasks") assert.equal(await page.locator(".ui-overlay--sheet-right").isVisible(), true);
  await checkContentBounds(page);
  await page.getByRole("button", { name: view === "tasks" ? "保存任务" : "保存日程", exact: true }).click({ trial: true });
}

export async function checkSessionActionFade(row: Locator): Promise<void> {
  const fade = await row.evaluate((element) => {
    const actions = element.querySelector<HTMLElement>(".session-actions")!;
    const button = actions.querySelector<HTMLButtonElement>("button")!;
    const actionBox = actions.getBoundingClientRect();
    const buttonBox = button.getBoundingClientRect();
    const style = getComputedStyle(actions, "::before");
    const stop = style.backgroundImage.match(/calc\(100% - ([\d.]+)px\)/);
    return {
      beforeButton: buttonBox.left - (actionBox.right - Number.parseFloat(style.width)),
      opaqueGap: stop ? buttonBox.left - (actionBox.right - Number(stop[1])) : -1,
      linkHit: document.elementFromPoint(buttonBox.left - 15, buttonBox.y + buttonBox.height / 2)?.closest("a") === element.querySelector("a"),
    };
  });
  assert.ok(fade.beforeButton >= 36 && fade.beforeButton <= 48, "title fading starts close to the action button");
  assert.ok(fade.opaqueGap >= 6 && fade.opaqueGap <= 10, "title becomes fully covered just before the action button");
  assert.equal(fade.linkHit, true, "the visual fade does not intercept the conversation link");
}

export async function checkContentBounds(page: Page): Promise<void> {
  const overflow = await page.locator(".bibo-topbar-leading, .bibo-topbar-actions, .workspace-toolbar, .bibo-summary-card, .ui-list-row, .bibo-detail-pane, .bibo-workspace, .ui-overlay, [role=menu], .file-editor-tools").evaluateAll((elements) => elements.flatMap((element) => {
    const box = element.getBoundingClientRect();
    if (!box.width || !box.height || element.closest('[aria-hidden="true"]')) return [];
    return box.left < -1 || box.right > innerWidth + 1 || element.scrollWidth > element.clientWidth + 1
      ? [{ className: element.className, left: box.left, right: box.right, width: element.clientWidth, scrollWidth: element.scrollWidth }] : [];
  }));
  assert.deepEqual(overflow, [], "visible content and actions must fit; an outer overflow:hidden must not conceal broken layout");
}

export async function checkThemes(page: Page, width: number, base: string): Promise<void> {
  await page.goto(`${base}/chat/session-a`, { waitUntil: "networkidle" });
  if (width > 760) await checkRailGeometry(page);
  if (width > 760) await checkShellFrame(page, width);
  const composer = page.getByRole("textbox", { name: /告诉 Bibo/ });
  await checkAssistantReading(page);
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
  if (width > 760) await checkRailGeometry(page);
  await composer.fill("");
  await checkThemePersistence(page, width);
}

async function checkRailGeometry(page: Page): Promise<void> {
  const entries = await page.locator(".bibo-navigation-rail .ui-navigation-item").evaluateAll((elements) => elements.map((element) => {
    const box = element.getBoundingClientRect();
    const icon = element.querySelector("svg")!;
    const iconBox = icon.getBoundingClientRect();
    return { width: box.width, height: box.height, iconWidth: iconBox.width, iconHeight: iconBox.height, stroke: getComputedStyle(icon).strokeWidth };
  }));
  assert.equal(entries.length, 9, "module, sidebar and account entries share the navigation primitive");
  const size = await page.evaluate(() => matchMedia("(pointer: coarse)").matches ? 44 : 36);
  for (const entry of entries) assert.deepEqual(entry, { width: size, height: size, iconWidth: 18, iconHeight: 18, stroke: "1.7px" }, "all rail entries share geometry and icon weight");
  const account = page.getByRole("button", { name: "账号与帮助" });
  await account.hover();
  const feedback = await account.evaluate((element) => getComputedStyle(element, "::before").backgroundColor);
  const module = page.locator(".bibo-navigation-rail a").first();
  await module.hover();
  assert.equal(await module.evaluate((element) => getComputedStyle(element, "::before").backgroundColor), feedback, "account and module hover use the same surface feedback");
  await page.mouse.move(600, 100);
}

async function checkShellFrame(page: Page, width: number): Promise<void> {
  const motion = await page.evaluate<{ opening: number[]; closing: number[]; reversed: number[]; closed: number; inert: boolean }>(`(async () => {
    const toggle = document.querySelector('[aria-label="打开右侧工作区"]');
    const panel = document.querySelector('.bibo-workspace');
    const measure = () => panel.getBoundingClientRect().width;
    const sample = async (duration) => {
      const values = [];
      const started = performance.now();
      do { await new Promise(requestAnimationFrame); values.push(measure()); } while (performance.now() - started < duration);
      return values;
    };
    toggle.click();
    const opening = await sample(320);
    toggle.click();
    const closing = await sample(40);
    toggle.click();
    const reversed = await sample(320);
    toggle.click();
    await sample(320);
    return { opening, closing, reversed, closed:measure(), inert:panel.inert };
  })()`);
  assert.ok(motion.opening.some(value => value > 1 && value < motion.opening.at(-1)! - 1), "workspace expands through intermediate widths");
  assert.ok(motion.closing.at(-1)! < motion.opening.at(-1)!, "workspace animates closed");
  assert.ok(motion.reversed.at(-1)! > motion.closing.at(-1)!, "rapid reversal smoothly reopens the workspace");
  assert.ok(motion.closed < 1 && motion.inert, "closed workspace releases its space and focus targets");
  await page.getByRole("button", { name: "打开右侧工作区" }).click();
  await page.waitForFunction(() => document.querySelector(".bibo-main")!.getAnimations().length === 0);
  await checkRailCenter(page, ".bibo-sidebar-panel");
  const frame = await page.evaluate(() => {
    const nodes = [".bibo-shell", ".bibo-navigation-rail", ".bibo-topbar", ".bibo-workspace-head"].map((selector) => document.querySelector<HTMLElement>(selector)!);
    const colors = nodes.map((node) => {
      for (let parent: HTMLElement | null = node; parent; parent = parent.parentElement) {
        const color = getComputedStyle(parent).backgroundColor;
        if (color !== "rgba(0, 0, 0, 0)" && color !== "transparent") return color;
      }
      return "transparent";
    });
    const top = nodes[2]!.getBoundingClientRect();
    const head = nodes[3]!.getBoundingClientRect();
    const content = document.querySelector<HTMLElement>(".bibo-workspace-content")!;
    return { colors,
      aligned: top.top === head.top && top.bottom === head.bottom && content.getBoundingClientRect().top === top.bottom,
      radius: parseFloat(getComputedStyle(nodes[3]!).borderTopLeftRadius),
      margin: innerWidth - document.querySelector(".bibo-workspace")!.getBoundingClientRect().right };
  });
  assert.equal(frame.colors[0], frame.colors[1], "rail retains the outer frame color");
  assert.equal(frame.colors[2], frame.colors[3], "headers share the inner canvas color");
  assert.notEqual(frame.colors[0], frame.colors[2], "inner canvas separates from the light outer frame");
  assert.equal(frame.aligned, true, "workspace title shares the global header row");
  assert.ok(frame.radius >= 16 && frame.radius <= 20 && frame.margin === 8);
  await page.screenshot({ path: `/tmp/bibo-frame-${width}.png` });
  await page.locator(".bibo-primary-nav").getByRole("link", { name: "笔记", exact: true }).click();
  await page.locator(".bibo-note-list").waitFor();
  await page.locator(".bibo-primary-nav").getByRole("link", { name: "对话", exact: true }).click();
  await page.locator(".bibo-chat-layout").waitFor();
  assert.ok(await page.locator(".bibo-main").evaluate(element => element.getAnimations().length === 0 && element.querySelector(".bibo-workspace")!.getBoundingClientRect().width > 300), "returning to chat restores the open workspace without an entrance animation");
  await page.getByRole("button", { name: "关闭工作区" }).click();
  assert.ok(await page.locator(".bibo-main").evaluate(element => element.getAnimations().length > 0), "the first toggle after returning still animates");
  await page.waitForFunction(() => document.querySelector(".bibo-workspace")!.getBoundingClientRect().width < 1);
  assert.ok(await page.locator(".bibo-workspace").evaluate(node => (node as HTMLElement).inert), "closed workspace cannot receive keyboard focus");
  await page.getByRole("button", { name: "收起侧边栏" }).click();
  await page.waitForFunction(() => document.querySelector(".bibo-sidebar")!.getAnimations().length === 0);
  await checkRailCenter(page, ".bibo-chat-layout");
  assert.ok(await page.locator(".bibo-topbar").evaluate((node) => parseFloat(getComputedStyle(node).borderTopLeftRadius) >= 16), "collapsed navigation retains the inner rounded surface");
  await page.getByRole("button", { name: "展开侧边栏" }).click();
  await page.waitForFunction(() => document.querySelector(".bibo-sidebar")!.getAnimations().length === 0);
}

async function checkRailCenter(page: Page, contentSelector: string): Promise<void> {
  const spacing = await page.evaluate((selector) => {
    const rail = document.querySelector(".bibo-navigation-rail")!.getBoundingClientRect();
    const item = document.querySelector(".bibo-navigation-rail .bibo-nav-item")!.getBoundingClientRect();
    const account = document.querySelector(".bibo-navigation-rail .account-menu-trigger")!.getBoundingClientRect();
    const content = document.querySelector(selector)!.getBoundingClientRect();
    return { left: item.left - rail.left, right: content.left - item.right, accountCenter: account.left + account.width / 2, itemCenter: item.left + item.width / 2 };
  }, contentSelector);
  assert.equal(spacing.left, spacing.right, "rail navigation has equal visible margins beside its content surface");
  assert.equal(spacing.accountCenter, spacing.itemCenter, "account and navigation icons share a centerline");
  assert.ok(await page.locator(".bibo-navigation-rail .account-menu-trigger").evaluate(element => {
    const button = element.getBoundingClientRect(), icon = element.querySelector("svg")!.getBoundingClientRect();
    return Math.abs(button.x + button.width / 2 - icon.x - icon.width / 2) < .5 && Math.abs(button.y + button.height / 2 - icon.y - icon.height / 2) < .5;
  }), "account glyph stays centered inside the shared icon button");
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
  const action = page.getByRole("button", { name: "已处理", exact: true });
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
  if (width > 760) await checkIconFeedback(page, base);
}

async function checkIconFeedback(page: Page, base: string): Promise<void> {
  await page.goto(`${base}/chat/session-a`, { waitUntil: "networkidle" });
  const frameAction = page.locator(".bibo-topbar-actions .ui-icon-button").first();
  await frameAction.hover();
  const frameFeedback = await frameAction.evaluate((element) => ({
    hover: getComputedStyle(element, "::before").backgroundColor,
    surface: getComputedStyle(element.closest(".bibo-shell")!).backgroundColor,
  }));
  assert.notEqual(frameFeedback.hover, frameFeedback.surface, "shared icon hover contrasts with the frame background");
  const sidebarAction = page.getByRole("button", { name: "新建会话", exact: true });
  await sidebarAction.hover();
  const sidebarFeedback = await sidebarAction.evaluate((element) => ({
    hover: getComputedStyle(element, "::before").backgroundColor,
    surface: getComputedStyle(element.closest(".bibo-sidebar-panel")!).backgroundColor,
  }));
  assert.notEqual(sidebarFeedback.hover, sidebarFeedback.surface, "shared icon hover contrasts with the sidebar background");
  const account = page.getByRole("button", { name: "账号与帮助", exact: true });
  await account.hover();
  assert.ok(await account.evaluate(element => getComputedStyle(element, "::before").backgroundColor !== getComputedStyle(element.closest(".bibo-navigation-rail")!).backgroundColor), "account icon hover contrasts with the rail");
  await account.click();
  await page.getByRole("menuitemradio", { name: "Bibo 经典" }).waitFor();
  const topbar = (await page.locator(".bibo-topbar").boundingBox())!;
  await page.mouse.click(topbar.x + topbar.width / 2, topbar.y + topbar.height / 2);
  await page.getByRole("menu").waitFor({ state: "hidden" });
  assert.equal(await account.evaluate(element => element === document.activeElement), false, "pointer dismissal does not restore trigger focus");
  assert.equal(await page.getByRole("tooltip").count(), 0, "pointer dismissal leaves no tooltip");
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
    assert.equal(feedback.radius, "12px");
  }
}

export async function checkFileTabs(page: Page): Promise<void> {
  for (let index = 0; index < 10; index++) {
    const back = page.locator(".file-mobile-back button");
    if (await back.isVisible()) await back.click();
    await page.getByRole("treeitem", { name: `review-document-${index}.md`, exact: true }).click();
    await openMarkdownSource(page);
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
  assert.equal(await editor.textContent(), "未保存的文件草稿", "moving tab focus does not activate another file");
  await page.keyboard.press("Enter");
  await page.waitForFunction((id) => document.getElementById(id!)?.getAttribute("aria-selected") === "true", firstTabId);
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await openMarkdownSource(page);
  await editor.waitFor();
  assert.equal(await editor.textContent(), "未保存的文件草稿");
}

async function checkAssistantReading(page: Page): Promise<void> {
  const reading = await page.locator(".ui-message--assistant:has(.ui-message__actions)").last().evaluate(element => {
    const body = element.querySelector(".ui-message__body")!, actions = element.querySelector(".ui-message__actions")!;
    const probe = document.createElement("span");
    probe.style.background = "var(--ui-assistant-message)"; element.append(probe);
    const background = getComputedStyle(probe).backgroundColor; probe.remove();
    return { card: getComputedStyle(body).backgroundColor, background, gap: Math.abs(body.getBoundingClientRect().left - actions.getBoundingClientRect().left), theme: document.documentElement.dataset.biboTheme };
  });
  assert.ok(reading.card === reading.background && reading.background !== "rgba(0, 0, 0, 0)" && reading.gap < 1, `assistant reading card stays neutral and copy actions align left: ${JSON.stringify(reading)}`);
}

export async function checkOverviewCanvas(page: Page, width: number): Promise<void> {
      if (width > 760) {
        await page.getByRole("button", { name: "收起侧边栏" }).click();
        await page.waitForFunction(() => document.querySelector(".bibo-sidebar")!.getAnimations().length === 0);
        assert.ok(await page.locator(".bibo-space-scroll").evaluate(element => {
          const style = getComputedStyle(element), box = element.getBoundingClientRect();
          return box.top === 8 && parseFloat(style.borderTopLeftRadius) >= 16 && parseFloat(style.borderTopRightRadius) >= 16 && !element.contains(document.elementFromPoint(box.left + 1, box.top + 1)) && !element.contains(document.elementFromPoint(box.right - 1, box.top + 1));
        }), "overview without a header clips both upper corners when navigation collapses");
        await page.getByRole("button", { name: "展开侧边栏" }).click();
        await page.waitForFunction(() => document.querySelector(".bibo-sidebar")!.getAnimations().length === 0);
      }
}

async function checkThemePersistence(page: Page, width: number): Promise<void> {
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.locator("html").getAttribute("data-bibo-theme"), "neutral", "theme survives refresh");
  if (width > 760) await checkShellFrame(page, width);
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

export async function checkMobileDrawerTooltip(page: Page, width: number, touch: boolean, base: string): Promise<void> {
  await page.goto(`${base}/chat`, { waitUntil: "networkidle" });
  const trigger = page.getByRole("button", { name: "打开菜单", exact: true });
  if (touch) await trigger.tap(); else await trigger.click();
  const drawer = page.getByRole("dialog", { name: "个人空间" });
  await drawer.waitFor();
  const nav = await drawer.locator(".bibo-primary-nav").evaluate((element) => {
    const first = element.querySelector("a")!;
    const navBox = element.getBoundingClientRect();
    const itemBox = first.getBoundingClientRect();
    return { justify: getComputedStyle(element).justifyItems, left: itemBox.left - navBox.left, right: navBox.right - itemBox.right };
  });
  assert.equal(nav.justify, "normal", "mobile drawer navigation remains left aligned");
  assert.ok(Math.abs(nav.left - nav.right) <= 1, "mobile navigation fills the drawer instead of centering its labels");
  await page.waitForTimeout(400);
  assert.equal(await page.getByRole("tooltip").count(), 0, "opening a mobile drawer must not display a tooltip");
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("role")), "dialog");
  await page.screenshot({ path: `/tmp/bibo-mobile-drawer-${width}${touch ? "" : "-hybrid"}.png` });
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "关闭导航");
  await page.getByRole("button", { name: "新建会话" }).focus();
  await page.waitForTimeout(400);
  assert.equal(await page.getByRole("tooltip").count(), 0, "a focused drawer action must not show a floating tooltip");
  await page.keyboard.press("Escape");
  await drawer.waitFor({ state: "hidden" });
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "打开菜单", undefined, { timeout: 1500 });
  await page.waitForTimeout(400);
  assert.equal(await page.getByRole("tooltip").count(), 0, "restoring focus must not display a tooltip");
}
