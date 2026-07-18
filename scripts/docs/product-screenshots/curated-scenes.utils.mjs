import { readFileSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const workspaceStateKey = 'nextclaw.chat.workspace-panel.state';

export function resolveScreenshotMode(argv, configuredMode) {
  const modeArg = argv.find((argument) => argument.startsWith('--mode='));
  const mode = String(configuredMode || modeArg?.slice('--mode='.length) || 'stable').trim();
  if (mode !== 'stable' && mode !== 'curated') {
    throw new Error(`unsupported screenshot mode: ${mode}`);
  }
  return mode;
}

export function parseBooleanEnv(raw) {
  if (!raw) {
    return false;
  }
  const value = String(raw).trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

function buildSessionRoute(sessionId) {
  const routeId = Buffer.from(sessionId, 'utf8').toString('base64url');
  return `/chat/sid_${routeId}`;
}

function createWorkspacePreviewStorage(previewPath, sessionId) {
  const resolvedPath = path.resolve(previewPath);
  let previewText;
  try {
    previewText = readFileSync(resolvedPath, 'utf8');
  } catch {
    throw new Error(`failed to read curated workspace preview: ${resolvedPath}`);
  }
  const previewKey = `${sessionId}::preview:rendered::${resolvedPath}`;
  return {
    [workspaceStateKey]: JSON.stringify({
      state: {
        snapshot: {
          workspacePanelParentKey: sessionId,
          activeWorkspacePanelKind: 'file',
          activeChildSessionKey: null,
          workspaceFileTabs: [{
            key: previewKey,
            parentSessionKey: sessionId,
            path: resolvedPath,
            label: path.basename(resolvedPath),
            viewMode: 'preview',
            previewViewer: 'rendered',
            rawText: previewText
          }],
          activeWorkspaceFileKey: previewKey,
          workspaceNavigationHistory: [{ kind: 'file', key: previewKey }],
          workspaceNavigationHistoryIndex: 0
        }
      },
      version: 2
    })
  };
}

async function waitForVisibleMainTarget(locator, description, minimumX = 320) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const count = await locator.count();
    for (let index = count - 1; index >= 0; index -= 1) {
      const candidate = locator.nth(index);
      const box = await candidate.boundingBox();
      if (box && box.x > minimumX && box.width > 0 && box.height > 0) {
        return candidate;
      }
    }
    await delay(250);
  }
  throw new Error(`failed to locate ${description} in the main content area`);
}

async function findRepresentativeImage(page) {
  await page.waitForFunction(() => Array.from(document.images).some((image) => {
    const rect = image.getBoundingClientRect();
    return image.complete && image.naturalWidth >= 320 && image.naturalHeight >= 180 &&
      rect.x > 280 && rect.width >= 280 && rect.height >= 160;
  }), undefined, { timeout: 30_000 });
  const imageIndex = await page.locator('img').evaluateAll((images) => {
    for (let index = images.length - 1; index >= 0; index -= 1) {
      const image = images[index];
      const rect = image.getBoundingClientRect();
      const isRepresentative = image.complete && image.naturalWidth >= 320 && image.naturalHeight >= 180 &&
        rect.x > 280 && rect.width >= 280 && rect.height >= 160;
      if (isRepresentative) {
        return index;
      }
    }
    return -1;
  });
  if (imageIndex < 0) {
    throw new Error('failed to locate a representative content image in the selected session');
  }
  return page.locator('img').nth(imageIndex);
}

async function waitForCuratedSession(page, options) {
  const { keepSidebar, sidebarSearch, targetSelector, targetText } = options;
  const minimumTargetX = keepSidebar ? 275 : 320;
  await page.waitForFunction(() => {
    const hasInput = Boolean(document.querySelector('textarea, [contenteditable="true"]'));
    const hasLoadingSkeleton = Boolean(document.querySelector('[data-loading="true"], [aria-busy="true"]'));
    return hasInput && !hasLoadingSkeleton;
  }, undefined, { timeout: 30_000 });

  let target;
  if (targetSelector) {
    target = await waitForVisibleMainTarget(
      page.locator(targetSelector),
      `SCREENSHOT_TARGET_SELECTOR=${targetSelector}`,
      minimumTargetX
    );
  } else if (targetText) {
    target = await waitForVisibleMainTarget(
      page.getByText(targetText, { exact: false }),
      `SCREENSHOT_TARGET_TEXT=${targetText}`,
      minimumTargetX
    );
  } else {
    target = await findRepresentativeImage(page);
  }

  if (!keepSidebar) {
    const collapseSidebar = page.getByRole('button', { name: /^(收起侧边栏|Collapse sidebar)$/ }).first();
    if (await collapseSidebar.isVisible()) {
      await collapseSidebar.click();
    }
  }

  if (sidebarSearch) {
    const searchInput = page.locator(
      'input[placeholder*="搜索对话"], input[placeholder*="Search conversations"]'
    );
    if (await searchInput.count() !== 1) {
      throw new Error('failed to locate the sidebar conversation search input');
    }
    await searchInput.fill(sidebarSearch);
  }

  await target.evaluate((element) => {
    const message = element.closest('[data-message-id], article') || element;
    message.scrollIntoView({ block: 'start', inline: 'nearest' });
  });
  await page.waitForTimeout(1_000);
}

export function createCuratedScreenshotScenes(options) {
  const {
    assetName,
    keepSidebar,
    sessionId,
    sidebarSearch,
    targetSelector,
    targetText,
    workspacePreviewPath
  } = options;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(assetName)) {
    throw new Error(`invalid SCREENSHOT_CURATED_ASSET: ${assetName}`);
  }
  if (!sessionId) {
    return [];
  }
  const route = buildSessionRoute(sessionId);
  const storageItems = workspacePreviewPath
    ? createWorkspacePreviewStorage(workspacePreviewPath, sessionId)
    : undefined;
  const afterLoad = async ({ page }) => waitForCuratedSession(page, {
    keepSidebar,
    sidebarSearch,
    targetSelector,
    targetText
  });
  return Object.entries({ en: 'en', zh: 'cn' }).map(([language, assetSuffix]) => ({
    id: `${assetName}-${language}`,
    route,
    language,
    afterLoad,
    storageItems,
    outputs: [
      `images/screenshots/${assetName}-${assetSuffix}.png`,
      `apps/landing/public/${assetName}-${assetSuffix}.png`
    ]
  }));
}

export function createScreenshotModeState({ argv, env, sceneFilter, stableScenes }) {
  const screenshotMode = resolveScreenshotMode(argv, env.SCREENSHOT_MODE);
  const curatedSessionId = String(env.SCREENSHOT_SESSION_ID || '').trim();
  const useRealAppData = screenshotMode === 'curated' || parseBooleanEnv(
    env.SCREENSHOT_USE_REAL_APP_DATA || env.SCREENSHOT_REAL_APP_DATA
  );
  const matchesSceneFilter = (scene) => !sceneFilter || sceneFilter.has(scene.id);
  const resolveScenesToCapture = () => {
    const availableScenes = screenshotMode === 'curated'
      ? createCuratedScreenshotScenes({
          assetName: String(env.SCREENSHOT_CURATED_ASSET || 'nextclaw-image-generation-result').trim(),
          keepSidebar: parseBooleanEnv(env.SCREENSHOT_KEEP_SIDEBAR),
          sessionId: curatedSessionId,
          sidebarSearch: String(env.SCREENSHOT_SIDEBAR_SEARCH || '').trim(),
          targetSelector: String(env.SCREENSHOT_TARGET_SELECTOR || '').trim(),
          targetText: String(env.SCREENSHOT_TARGET_TEXT || '').trim(),
          workspacePreviewPath: String(env.SCREENSHOT_WORKSPACE_PREVIEW_PATH || '').trim()
        })
      : stableScenes;
    return availableScenes.filter((scene) =>
      matchesSceneFilter(scene) && (!scene.realAppOnly || useRealAppData)
    );
  };
  const assertCanRun = () => {
    if (screenshotMode === 'curated' && (!env.SCREENSHOT_UI_ORIGIN || !curatedSessionId)) {
      throw new Error('curated mode requires SCREENSHOT_UI_ORIGIN and SCREENSHOT_SESSION_ID');
    }
  };
  return { assertCanRun, resolveScenesToCapture, screenshotMode, useRealAppData };
}
