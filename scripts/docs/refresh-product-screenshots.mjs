import { spawn } from 'node:child_process';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { resolveRepoPath } from '../shared/repo-paths.mjs';
import {
  agentsPayload,
  channelSpecs,
  configPayload,
  providerSpecs,
  providerTemplatesPayload,
  providersPayload,
  schemaPayload
} from './product-screenshot-config-mocks.mjs';
import {
  authStatusPayload,
  bootstrapStatusPayload,
  remoteStatusPayload,
  runtimeControlPayload,
  runtimeUpdatePayload
} from './product-screenshot-status-mocks.mjs';
import { createScreenshotRouteMockResolver } from './product-screenshot-route-mocks.utils.mjs';
import {
  initializeScreenshotDocument,
  installMockApiRoutes,
  openFirstSkillDetail,
  waitForChatReady,
  waitForSceneText,
  writeSceneOutputs
} from './product-screenshot-browser-helpers.mjs';
import { createLocalPanelScreenshotData } from './product-screenshot-local-panels.utils.mjs';

const repoRoot = resolveRepoPath(import.meta.url);
const localPanels = createLocalPanelScreenshotData({ repoRoot });

const DEFAULT_UI_PORT = Number(process.env.SCREENSHOT_UI_PORT || 5194);
const shouldStartUi = !process.env.SCREENSHOT_UI_ORIGIN;
const useRealAppData = parseBooleanEnv(process.env.SCREENSHOT_USE_REAL_APP_DATA || process.env.SCREENSHOT_REAL_APP_DATA);
const useRealMarketplace = parseBooleanEnv(process.env.REAL_MARKETPLACE || process.env.SCREENSHOT_REAL_MARKETPLACE);
const sceneFilter = parseSceneFilter(process.env.SCREENSHOT_SCENES || process.env.SCREENSHOT_SCENE);
const realMarketplaceBase = normalizeBaseUrl(
  process.env.REAL_MARKETPLACE_BASE || process.env.SCREENSHOT_REAL_MARKETPLACE_BASE || 'https://marketplace-api.nextclaw.io'
);

const languageStorageKey = 'nextclaw.ui.language';
const themeStorageKey = 'nextclaw.ui.theme';
const screenshotTheme = process.env.SCREENSHOT_UI_THEME || 'cool';
const viewport = { width: 1512, height: 828 };
const deviceScaleFactor = 2;

function parseBooleanEnv(raw) {
  if (!raw) {
    return false;
  }
  const value = String(raw).trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

function normalizeBaseUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) {
    return 'https://marketplace-api.nextclaw.io';
  }
  return value.replace(/\/+$/, '');
}

function parseSceneFilter(raw) {
  const value = String(raw || '').trim();
  if (!value) {
    return null;
  }
  return new Set(
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
}

function matchesSceneFilter(scene) {
  if (!sceneFilter) {
    return true;
  }
  return sceneFilter.has(scene.id);
}

const uiText = {
  en: {
    providers: 'AI Providers',
    channels: 'Message Channels',
    agents: 'Agent Gallery',
    apps: 'Panel Apps',
    skillMarketplace: 'Skill Market',
    cron: 'Cron Jobs',
    chatWelcome: 'Hello, how can I help you?'
  },
  zh: {
    providers: 'AI 提供商',
    channels: '消息渠道',
    agents: 'Agent 管理台',
    apps: '面板应用',
    skillMarketplace: '技能市场',
    cron: '定时任务',
    chatWelcome: '你好，有什么可以帮你的吗？'
  }
};

async function waitForDocBrowserPanel(page) {
  await page.waitForSelector('[data-testid="doc-browser-panel"]', { timeout: 20_000 });
  await page.waitForTimeout(1_000);
}

async function waitForPanelAppFrame(page) {
  await waitForDocBrowserPanel(page);
  await page.waitForSelector('iframe[src*="/api/panel-apps/"]', { timeout: 20_000 });
  await page.waitForTimeout(1_000);
}

async function waitForWorkspacePreview(page) {
  await page.waitForSelector('[data-testid="chat-session-workspace-panel"]', { timeout: 20_000 });
  await page.waitForSelector('[data-testid="workspace-html-preview"]', { timeout: 20_000 });
  await page.waitForTimeout(1_000);
}

const scenes = [
  {
    id: 'providers-en',
    route: '/providers',
    language: 'en',
    waitText: uiText.en.providers,
    outputs: [
      'images/screenshots/nextclaw-providers-page-en.png',
      'images/screenshots/nextclaw-providers-page.png',
      'apps/landing/public/nextclaw-providers-page-en.png'
    ]
  },
  {
    id: 'providers-zh',
    route: '/providers',
    language: 'zh',
    waitText: uiText.zh.providers,
    outputs: [
      'images/screenshots/nextclaw-providers-page-cn.png',
      'apps/landing/public/nextclaw-providers-page-cn.png'
    ]
  },
  {
    id: 'channels-en',
    route: '/channels',
    language: 'en',
    waitText: uiText.en.channels,
    outputs: [
      'images/screenshots/nextclaw-channels-page-en.png',
      'images/screenshots/nextclaw-channels-page.png',
      'apps/landing/public/nextclaw-channels-page-en.png'
    ]
  },
  {
    id: 'channels-zh',
    route: '/channels',
    language: 'zh',
    waitText: uiText.zh.channels,
    outputs: [
      'images/screenshots/nextclaw-channels-page-cn.png',
      'apps/landing/public/nextclaw-channels-page-cn.png'
    ]
  },
  {
    id: 'agents-en',
    route: '/agents',
    language: 'en',
    waitText: uiText.en.agents,
    outputs: [
      'images/screenshots/nextclaw-agents-page-en.png',
      'images/screenshots/nextclaw-agents-page.png',
      'apps/landing/public/nextclaw-agents-page-en.png'
    ]
  },
  {
    id: 'agents-zh',
    route: '/agents',
    language: 'zh',
    waitText: uiText.zh.agents,
    outputs: [
      'images/screenshots/nextclaw-agents-page-cn.png',
      'apps/landing/public/nextclaw-agents-page-cn.png'
    ]
  },
  {
    id: 'marketplace-skills',
    route: '/marketplace/skills',
    language: 'en',
    waitText: uiText.en.skillMarketplace,
    outputs: [
      'images/screenshots/nextclaw-skills-page.png',
      'apps/landing/public/nextclaw-skills-page-en.png'
    ]
  },
  {
    id: 'marketplace-skills-zh',
    route: '/marketplace/skills',
    language: 'zh',
    waitText: uiText.zh.skillMarketplace,
    outputs: [
      'images/screenshots/nextclaw-skills-page-cn.png',
      'apps/landing/public/nextclaw-skills-page-cn.png'
    ]
  },
  {
    id: 'cron-jobs',
    route: '/cron',
    language: 'en',
    waitText: uiText.en.cron,
    outputs: [
      'images/screenshots/nextclaw-cron-job-page-en.png',
      'images/screenshots/nextclaw-cron-job-page.png',
      'apps/landing/public/nextclaw-cron-job-page-en.png'
    ]
  },
  {
    id: 'cron-jobs-zh',
    route: '/cron',
    language: 'zh',
    waitText: uiText.zh.cron,
    outputs: [
      'images/screenshots/nextclaw-cron-job-page-cn.png',
      'apps/landing/public/nextclaw-cron-job-page-cn.png'
    ]
  },
  {
    id: 'chat-home-en',
    route: `/chat/${localPanels.workspaceSessionId}`,
    language: 'en',
    afterLoad: async ({ page }) => waitForChatReady(page),
    outputs: [
      'images/screenshots/nextclaw-chat-page-en.png',
      'images/screenshots/nextclaw-ui-screenshot.png',
      'apps/landing/public/nextclaw-chat-page-en.png'
    ]
  },
  {
    id: 'chat-home-zh',
    route: `/chat/${localPanels.workspaceSessionId}`,
    language: 'zh',
    afterLoad: async ({ page }) => waitForChatReady(page),
    outputs: [
      'images/screenshots/nextclaw-chat-page-cn.png',
      'apps/landing/public/nextclaw-chat-page-cn.png'
    ]
  },
  {
    id: 'apps-panel-en',
    route: `/chat/${localPanels.workspaceSessionId}`,
    language: 'en',
    storageItems: localPanels.createAppsPanelStorage('en'),
    afterLoad: async ({ page }) => waitForDocBrowserPanel(page),
    outputs: [
      'images/screenshots/nextclaw-panel-apps-page-en.png',
      'apps/landing/public/nextclaw-panel-apps-page-en.png'
    ]
  },
  {
    id: 'apps-panel-zh',
    route: `/chat/${localPanels.workspaceSessionId}`,
    language: 'zh',
    storageItems: localPanels.createAppsPanelStorage('zh'),
    afterLoad: async ({ page }) => waitForDocBrowserPanel(page),
    outputs: [
      'images/screenshots/nextclaw-panel-apps-page-cn.png',
      'apps/landing/public/nextclaw-panel-apps-page-cn.png'
    ]
  },
  {
    id: 'panel-app-running-en',
    route: `/chat/${localPanels.workspaceSessionId}`,
    language: 'en',
    storageItems: localPanels.createPanelAppStorage('en'),
    afterLoad: async ({ page }) => waitForPanelAppFrame(page),
    outputs: [
      'images/screenshots/nextclaw-panel-app-running-en.png',
      'apps/landing/public/nextclaw-panel-app-running-en.png'
    ]
  },
  {
    id: 'panel-app-running-zh',
    route: `/chat/${localPanels.workspaceSessionId}`,
    language: 'zh',
    storageItems: localPanels.createPanelAppStorage('zh'),
    afterLoad: async ({ page }) => waitForPanelAppFrame(page),
    outputs: [
      'images/screenshots/nextclaw-panel-app-running-cn.png',
      'apps/landing/public/nextclaw-panel-app-running-cn.png'
    ]
  },
  {
    id: 'workspace-preview-en',
    route: `/chat/${localPanels.workspaceSessionId}`,
    language: 'en',
    storageItems: localPanels.createWorkspacePreviewStorage(),
    afterLoad: async ({ page }) => waitForWorkspacePreview(page),
    outputs: [
      'images/screenshots/nextclaw-workspace-preview-en.png',
      'apps/landing/public/nextclaw-workspace-preview-en.png'
    ]
  },
  {
    id: 'workspace-preview-zh',
    route: `/chat/${localPanels.workspaceSessionId}`,
    language: 'zh',
    storageItems: localPanels.createWorkspacePreviewStorage(),
    afterLoad: async ({ page }) => waitForWorkspacePreview(page),
    outputs: [
      'images/screenshots/nextclaw-workspace-preview-cn.png',
      'apps/landing/public/nextclaw-workspace-preview-cn.png'
    ]
  },
  {
    id: 'skills-detail-en',
    route: '/marketplace/skills',
    language: 'en',
    waitText: uiText.en.skillMarketplace,
    afterLoad: async ({ page }) => openFirstSkillDetail(page),
    outputs: [
      'images/screenshots/nextclaw-skills-doc-browser-en.png',
      'apps/landing/public/nextclaw-skills-doc-browser-en.png'
    ]
  },
  {
    id: 'skills-detail-zh',
    route: '/marketplace/skills',
    language: 'zh',
    waitText: uiText.zh.skillMarketplace,
    afterLoad: async ({ page }) => openFirstSkillDetail(page),
    outputs: [
      'images/screenshots/nextclaw-skills-doc-browser-cn.png',
      'apps/landing/public/nextclaw-skills-doc-browser-cn.png'
    ]
  }
];

const marketplaceSkills = [
  {
    id: 'skill-nextclaw-content-ops',
    slug: 'content-ops',
    type: 'skill',
    name: 'Content Ops',
    summary: 'Draft, rewrite, and repurpose long-form content.',
    summaryI18n: {
      en: 'Draft, rewrite, and repurpose long-form content.',
      zh: '用于撰写、改写与内容重组。'
    },
    tags: ['writing', 'workflow'],
    author: 'NextClaw',
    install: {
      kind: 'git',
      spec: 'https://github.com/nextclaw/skills/content-ops',
      command: 'nextclaw skill install content-ops'
    },
    updatedAt: '2026-03-03T00:00:00.000Z',
    publishedAt: '2026-02-28T00:00:00.000Z'
  },
  {
    id: 'skill-nextclaw-release-manager',
    slug: 'release-manager',
    type: 'skill',
    name: 'Release Manager',
    summary: 'Automate release checks and rollout notes.',
    summaryI18n: {
      en: 'Automate release checks and rollout notes.',
      zh: '自动化发布检查与发布说明。'
    },
    tags: ['release', 'automation'],
    author: 'NextClaw',
    install: {
      kind: 'git',
      spec: 'https://github.com/nextclaw/skills/release-manager',
      command: 'nextclaw skill install release-manager'
    },
    updatedAt: '2026-03-01T00:00:00.000Z',
    publishedAt: '2026-02-25T00:00:00.000Z'
  }
];

const installedSkillRecords = [
  {
    type: 'skill',
    id: 'skill-nextclaw-content-ops',
    spec: 'https://github.com/nextclaw/skills/content-ops',
    label: 'Content Ops',
    installedAt: '2026-03-05T01:00:00.000Z',
    enabled: true,
    source: 'workspace',
    installPath: 'skills/content-ops'
  }
];

const cronJobs = [
  {
    id: 'daily-briefing',
    name: 'Daily Briefing',
    enabled: true,
    schedule: { kind: 'cron', expr: '0 9 * * *', tz: 'Asia/Shanghai' },
    payload: {
      kind: 'agent_turn',
      message: 'Send today summary',
      deliver: true,
      channel: 'telegram',
      to: 'ops-team'
    },
    state: {
      nextRunAt: '2026-03-06T01:00:00.000Z',
      lastRunAt: '2026-03-05T01:00:00.000Z',
      lastStatus: 'ok'
    },
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-05T01:00:00.000Z',
    deleteAfterRun: false
  },
  {
    id: 'weekly-sync',
    name: 'Weekly Product Sync',
    enabled: false,
    schedule: { kind: 'cron', expr: '0 10 * * 1', tz: 'UTC' },
    payload: {
      kind: 'agent_turn',
      message: 'Draft weekly release plan',
      deliver: true,
      channel: 'discord',
      to: 'product'
    },
    state: {
      nextRunAt: '2026-03-09T10:00:00.000Z',
      lastRunAt: '2026-03-02T10:00:00.000Z',
      lastStatus: 'error',
      lastError: 'timeout'
    },
    createdAt: '2026-02-20T00:00:00.000Z',
    updatedAt: '2026-03-03T00:00:00.000Z',
    deleteAfterRun: false
  }
];

const staticGetMocks = new Map([
  ['/api/auth/status', authStatusPayload],
  ['/api/remote/status', remoteStatusPayload],
  ['/api/runtime/bootstrap-status', bootstrapStatusPayload],
  ['/api/runtime/control', runtimeControlPayload],
  ['/api/runtime/update', runtimeUpdatePayload],
  ['/api/config', configPayload],
  ['/api/config/meta', { providers: providerSpecs, channels: channelSpecs }],
  ['/api/providers', providersPayload],
  ['/api/provider-templates', providerTemplatesPayload],
  ['/api/config/schema', schemaPayload],
  ['/api/agents', agentsPayload],
  ['/api/sessions', { sessions: [], total: 0 }],
  ['/api/chat/capabilities', { stopSupported: true }],
  ['/api/chat/runs', { runs: [], total: 0 }],
  ['/api/cron', { jobs: cronJobs, total: cronJobs.length }],
  ['/api/marketplace/skills/installed', {
    type: 'skill',
    total: installedSkillRecords.length,
    specs: installedSkillRecords.map((record) => record.spec),
    records: installedSkillRecords
  }]
]);

const resolveMock = createScreenshotRouteMockResolver({ localPanels, marketplaceSkills, staticGetMocks });

function asObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value;
}

function buildMarketplaceContentFromItem(type, slug, item) {
  const safeItem = asObject(item) || {};
  const name = typeof safeItem.name === 'string' && safeItem.name.trim().length > 0 ? safeItem.name : slug;
  const summary = typeof safeItem.summary === 'string' ? safeItem.summary : '';
  const description = typeof safeItem.description === 'string' ? safeItem.description : '';
  const bodyRaw = description || summary;
  const install = asObject(safeItem.install) || { kind: 'git', spec: slug, command: '' };
  const sourceUrl =
    (typeof safeItem.sourceRepo === 'string' && safeItem.sourceRepo) ||
    (typeof safeItem.homepage === 'string' && safeItem.homepage) ||
    undefined;

  if (type === 'skill') {
    return {
      type: 'skill',
      slug,
      name,
      install,
      source: 'remote',
      raw: `# ${name}\n\n${bodyRaw}`,
      bodyRaw,
      metadataRaw: JSON.stringify(
        {
          id: safeItem.id,
          author: safeItem.author,
          tags: safeItem.tags,
          publishedAt: safeItem.publishedAt,
          updatedAt: safeItem.updatedAt
        },
        null,
        2
      ),
      sourceUrl
    };
  }

  return {
    type: 'mcp',
    slug,
    name,
    install,
    source: 'remote',
    bodyRaw,
    metadataRaw: JSON.stringify(
      {
        id: safeItem.id,
        author: safeItem.author,
        tags: safeItem.tags,
        publishedAt: safeItem.publishedAt,
        updatedAt: safeItem.updatedAt
      },
      null,
      2
    ),
    sourceUrl
  };
}

function buildRemoteMarketplaceApiUrl(type, endpoint, slug, searchParams) {
  const basePath =
    endpoint === 'recommendations'
      ? `/api/v1/${type}/recommendations`
      : slug
        ? `/api/v1/${type}/items/${encodeURIComponent(slug)}`
        : `/api/v1/${type}/items`;
  const query = searchParams.toString();
  return `${realMarketplaceBase}${basePath}${query ? `?${query}` : ''}`;
}

async function fetchRemoteMarketplaceJson(url) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    }
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = text.length > 0 ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(`real marketplace request failed (${response.status}) ${url}`);
  }

  const data = asObject(payload);
  if (!data || typeof data.ok !== 'boolean') {
    throw new Error(`real marketplace response shape invalid: ${url}`);
  }

  if (!data.ok) {
    const errorMessage =
      (asObject(data.error) && typeof data.error.message === 'string' ? data.error.message : 'unknown error');
    throw new Error(`real marketplace returned error for ${url}: ${errorMessage}`);
  }

  return data;
}

async function resolveRealMarketplace(pathname, searchParams, method) {
  if (!useRealMarketplace || method !== 'GET') {
    return null;
  }

  const catalogMatch = pathname.match(/^\/api\/marketplace\/(plugins|skills)\/(items|recommendations)$/);
  if (catalogMatch) {
    const type = catalogMatch[1];
    const endpoint = catalogMatch[2];
    const url = buildRemoteMarketplaceApiUrl(type, endpoint, null, searchParams);
    const payload = await fetchRemoteMarketplaceJson(url);
    return {
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(payload)
    };
  }

  const itemMatch = pathname.match(/^\/api\/marketplace\/(plugins|skills)\/items\/([^/]+)$/);
  if (itemMatch) {
    const type = itemMatch[1];
    const slug = decodeURIComponent(itemMatch[2]);
    const url = buildRemoteMarketplaceApiUrl(type, 'items', slug, searchParams);
    const payload = await fetchRemoteMarketplaceJson(url);
    return {
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(payload)
    };
  }

  const contentMatch = pathname.match(/^\/api\/marketplace\/(plugins|skills)\/items\/([^/]+)\/content$/);
  if (contentMatch) {
    const type = contentMatch[1];
    const slug = decodeURIComponent(contentMatch[2]);
    const itemUrl = buildRemoteMarketplaceApiUrl(type, 'items', slug, new URLSearchParams());
    const payload = await fetchRemoteMarketplaceJson(itemUrl);
    const item = asObject(payload.data);
    const content = buildMarketplaceContentFromItem(type === 'skills' ? 'skill' : 'plugin', slug, item);
    return {
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({
        ok: true,
        data: content
      })
    };
  }

  return null;
}

async function waitForServer(url, timeoutMs = 60_000) {
  const start = Date.now();
  let lastError = null;

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.ok || response.status === 404) {
        return;
      }
      lastError = new Error(`Unexpected response status ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(500);
  }

  throw new Error(`Timed out waiting for UI server (${url}): ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

function startUiServer(port) {
  const child = spawn(
    'pnpm',
    ['-C', 'packages/nextclaw-ui', 'dev', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );

  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[ui] ${chunk}`);
  });

  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[ui] ${chunk}`);
  });

  return child;
}

async function writeBuffer(targetPath, buffer) {
  const abs = path.resolve(repoRoot, targetPath);
  await mkdir(path.dirname(abs), { recursive: true });
  try {
    await writeFile(abs, buffer);
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'EACCES') {
      await chmod(abs, 0o644);
      await writeFile(abs, buffer);
      return;
    }
    throw error;
  }
}

function screenshotOptionsFor(outputPath) {
  if (outputPath.endsWith('.jpg') || outputPath.endsWith('.jpeg')) {
    return { type: 'jpeg', quality: 90 };
  }
  return { type: 'png' };
}

async function captureScene(browser, scene, uiOrigin) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor,
    colorScheme: 'light'
  });

  try {
    const pageErrors = [];
    await context.addInitScript(initializeScreenshotDocument, {
      key: languageStorageKey,
      value: scene.language,
      useMockRealtime: !useRealAppData
    });
    await context.addInitScript(({ key, value }) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // Screenshot init should continue even when storage is unavailable.
      }
    }, { key: themeStorageKey, value: screenshotTheme });
    if (scene.storageItems) {
      await context.addInitScript((items) => {
        for (const [key, value] of Object.entries(items)) {
          try {
            window.localStorage.setItem(key, value);
          } catch {
            // Screenshot init should continue even when storage is unavailable.
          }
        }
      }, scene.storageItems);
    }

    const page = await context.newPage();
    page.on('pageerror', (error) => {
      const message = error instanceof Error ? error.stack || error.message : String(error);
      pageErrors.push(message);
      console.error(`[screenshot] page error on ${scene.id}: ${message}`);
    });
    page.on('console', (message) => {
      if (message.type() === 'error') {
        console.warn(`[screenshot] console error on ${scene.id}: ${message.text()}`);
      }
    });

    if (!useRealAppData) {
      await installMockApiRoutes(page, {
        useRealMarketplace,
        resolveRealMarketplace,
        resolveMock
      });
    }

    await page.goto(`${uiOrigin}${scene.route}`, { waitUntil: 'domcontentloaded' });
    await waitForSceneText(page, scene);

    if (scene.afterLoad) {
      await scene.afterLoad({ page });
    }

    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          transition-duration: 0s !important;
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          caret-color: transparent !important;
        }
      `
    });

    await delay(600);

    if (pageErrors.length > 0) {
      throw new Error(`[screenshot] page errors on ${scene.id}: ${pageErrors.join(' | ')}`);
    }
    await writeSceneOutputs(page, scene, screenshotOptionsFor, writeBuffer);
  } finally {
    await context.close();
  }
}

async function main() {
  let uiProcess = null;
  const uiPort = DEFAULT_UI_PORT;
  const resolvedUiOrigin = process.env.SCREENSHOT_UI_ORIGIN || `http://127.0.0.1:${uiPort}`;
  const scenesToCapture = scenes.filter(matchesSceneFilter);

  try {
    if (useRealAppData) {
      console.log(`[screenshot] real app mode enabled. origin=${resolvedUiOrigin}`);
    }
    if (useRealMarketplace) {
      console.log(`[screenshot] REAL_MARKETPLACE enabled. source=${realMarketplaceBase}`);
    }

    if (shouldStartUi) {
      console.log('[screenshot] starting @nextclaw/ui dev server...');
      uiProcess = startUiServer(uiPort);
      await waitForServer(resolvedUiOrigin);
    } else {
      await waitForServer(resolvedUiOrigin, 20_000);
    }

    const browser = await chromium.launch({ headless: true });
    try {
      if (scenesToCapture.length === 0) {
        throw new Error(`[screenshot] no scenes matched filter: ${Array.from(sceneFilter || []).join(', ')}`);
      }
      for (const scene of scenesToCapture) {
        console.log(`[screenshot] capturing ${scene.id}`);
        await captureScene(browser, scene, resolvedUiOrigin);
      }
    } finally {
      await browser.close();
    }

    console.log(`[screenshot] done. generated ${scenesToCapture.length} scenes.`);
  } catch (error) {
    console.error('[screenshot] failed:', error);
    process.exitCode = 1;
  } finally {
    if (uiProcess && !uiProcess.killed) {
      uiProcess.kill('SIGTERM');
    }
  }
}

await main();
