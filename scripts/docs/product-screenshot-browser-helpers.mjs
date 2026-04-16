export async function openFirstSkillDetail(page) {
  const firstSkillCard = page.locator('article').first();
  await firstSkillCard.waitFor({ timeout: 20_000 });
  await page.waitForTimeout(2_000);
  let opened = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await firstSkillCard.click();
    try {
      await page.locator('iframe[src^="data:text/html"]').first().waitFor({ state: 'attached', timeout: 4_000 });
      opened = true;
      break;
    } catch (error) {
      if (attempt === 2) {
        throw error;
      }
      await page.waitForTimeout(1_500);
    }
  }
  if (!opened) {
    throw new Error('failed to open skill detail browser');
  }
  await page.waitForFunction(() => {
    const iframe = document.querySelector('iframe[src^="data:text/html"]');
    if (!(iframe instanceof HTMLIFrameElement)) {
      return false;
    }
    const rect = iframe.getBoundingClientRect();
    return rect.width >= 320 && rect.height >= 400;
  }, { timeout: 20_000 });
  await page.waitForTimeout(1_000);
}

export async function waitForChatReady(page) {
  await page.waitForFunction(() => {
    const bodyText = document.body?.innerText || '';
    const hasInput = Boolean(document.querySelector('textarea, [contenteditable="true"]'));
    const stillLoadingSessions =
      bodyText.includes('Loading sessions') ||
      bodyText.includes('正在加载会话') ||
      bodyText.includes('加载会话');
    const hasSkeleton = document.querySelectorAll('[class*="animate-pulse"], [class*="skeleton"]').length > 0;
    return hasInput && !stillLoadingSessions && !hasSkeleton;
  }, { timeout: 20_000 });
  await page.waitForTimeout(1_000);
}

export function initializeScreenshotDocument({ key, value, useMockRealtime }) {
  try {
    window.localStorage.setItem(key, value);
  } catch {}
  if (!useMockRealtime) {
    return;
  }
  class MockWebSocket {
    constructor() {
      this.readyState = 1;
      this.onopen = null;
      this.onclose = null;
      this.onmessage = null;
      this.onerror = null;
      setTimeout(() => {
        if (typeof this.onopen === 'function') {
          this.onopen(new Event('open'));
        }
      }, 0);
    }

    send() {}

    close() {
      this.readyState = 3;
      if (typeof this.onclose === 'function') {
        this.onclose(new Event('close'));
      }
    }

    addEventListener() {}
    removeEventListener() {}
  }
  window.WebSocket = MockWebSocket;
}

export async function installMockApiRoutes(page, { useRealMarketplace, resolveRealMarketplace, resolveMock }) {
  await page.route(
    (url) => new URL(url).pathname.startsWith('/api/'),
    async (route) => {
      const requestUrl = new URL(route.request().url());
      let response = null;
      if (useRealMarketplace && requestUrl.pathname.startsWith('/api/marketplace/')) {
        try {
          response = await resolveRealMarketplace(requestUrl.pathname, requestUrl.searchParams, route.request().method());
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`[screenshot] real marketplace fallback -> mock: ${requestUrl.pathname} (${message})`);
        }
      }

      if (!response) {
        response = resolveMock(requestUrl.pathname, requestUrl.searchParams, route.request().method());
      }

      await route.fulfill(response);
    }
  );
}

export async function waitForSceneText(page, scene) {
  if (!scene.waitText) {
    return;
  }
  try {
    const waitTexts = Array.isArray(scene.waitText) ? scene.waitText : [scene.waitText];
    await page.waitForFunction(
      (texts) => texts.some((text) => document.body?.innerText?.includes(text)),
      waitTexts,
      { timeout: 15_000 }
    );
  } catch (error) {
    const bodyText = (await page.textContent('body')) || '';
    const compact = bodyText.replace(/\s+/g, ' ').trim().slice(0, 240);
    console.error(`[screenshot] waitText timeout for ${scene.id}. url=${page.url()} body="${compact}"`);
    throw error;
  }
}

export async function writeSceneOutputs(page, scene, screenshotOptionsFor, writeBuffer) {
  const grouped = new Map();
  for (const output of scene.outputs) {
    const key = output.endsWith('.jpg') || output.endsWith('.jpeg') ? 'jpeg' : 'png';
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(output);
  }

  for (const outputs of grouped.values()) {
    const options = screenshotOptionsFor(outputs[0]);
    const buffer = await page.screenshot(options);
    for (const target of outputs) {
      await writeBuffer(target, buffer);
      console.log(`[screenshot] ${scene.id} -> ${target}`);
    }
  }
}
