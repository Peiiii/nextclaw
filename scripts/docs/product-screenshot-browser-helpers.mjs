export async function openFirstSkillDetail(page) {
  await page.waitForFunction(() => {
    return Array.from(document.querySelectorAll('article')).some((article) => {
      const rect = article.getBoundingClientRect();
      return rect.x > 280 && rect.width >= 240 && rect.height >= 140 && rect.top >= 0 && rect.top < window.innerHeight;
    });
  }, { timeout: 20_000 });
  await page.waitForTimeout(2_000);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const cardIndex = await page.locator('article').evaluateAll((articles) => {
      return articles.findIndex((article) => {
        const rect = article.getBoundingClientRect();
        return rect.x > 280 && rect.width >= 240 && rect.height >= 140 && rect.top >= 0 && rect.top < window.innerHeight;
      });
    });
    if (cardIndex < 0) {
      throw new Error('failed to locate a visible skill card');
    }
    await page.locator('article').nth(cardIndex).click();
    try {
      await page.waitForFunction(() => {
        const bodyText = document.body?.innerText || '';
        return (bodyText.includes('Metadata') && bodyText.includes('Content')) ||
          (bodyText.includes('元数据') && bodyText.includes('内容'));
      }, { timeout: 4_000 });
      break;
    } catch (error) {
      if (attempt === 2) {
        throw error;
      }
      await page.waitForTimeout(1_500);
    }
  }
  await page.waitForFunction(() => {
    const bodyText = document.body?.innerText || '';
    return bodyText.includes('Metadata') || bodyText.includes('元数据');
  }, { timeout: 20_000 });
  await page.waitForTimeout(1_000);
}

export async function waitForDocBrowserPanel(page) {
  await page.waitForSelector('[data-testid="doc-browser-panel"]', { timeout: 20_000 });
  await page.waitForTimeout(1_000);
}

export async function waitForPanelAppFrame(page) {
  await waitForDocBrowserPanel(page);
  await page.waitForSelector('iframe[src*="/api/panel-apps/"]', { timeout: 20_000 });
  await page.waitForTimeout(1_000);
}

export async function waitForWorkspacePreview(page) {
  await page.waitForSelector('[data-testid="chat-session-workspace-panel"]', { timeout: 20_000 });
  await page.waitForSelector('[data-testid="workspace-html-preview"]', { timeout: 20_000 });
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
  const sessionButtonIndex = await page.locator('button').evaluateAll((buttons) => {
    return buttons.findIndex((button) => {
      const rect = button.getBoundingClientRect();
      const text = button.textContent?.replace(/\s+/g, ' ').trim() || '';
      return rect.x < 280 && rect.y > 280 && rect.width > 120 && text.length > 20;
    });
  });
  if (sessionButtonIndex >= 0) {
    await page.locator('button').nth(sessionButtonIndex).click();
  }
  await page.waitForTimeout(1_000);
}

export function initializeScreenshotDocument({ key, value, useMockRealtime }) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Screenshot init should continue even when storage is unavailable.
  }
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
