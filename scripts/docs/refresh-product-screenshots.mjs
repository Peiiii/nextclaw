import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const DEFAULT_UI_PORT = Number(process.env.SCREENSHOT_UI_PORT || 5194);
const shouldStartUi = !process.env.SCREENSHOT_UI_ORIGIN;
const useRealMarketplace = parseBooleanEnv(process.env.REAL_MARKETPLACE || process.env.SCREENSHOT_REAL_MARKETPLACE);
const realMarketplaceBase = normalizeBaseUrl(
  process.env.REAL_MARKETPLACE_BASE || process.env.SCREENSHOT_REAL_MARKETPLACE_BASE || 'https://marketplace-api.nextclaw.io'
);

const languageStorageKey = 'nextclaw.ui.language';
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

const uiText = {
  en: {
    providers: 'AI Providers',
    channels: 'Message Channels',
    pluginMarketplace: 'Plugin Marketplace',
    skillMarketplace: 'Skill Marketplace',
    cron: 'Cron Jobs',
    chatWelcome: 'Hello, how can I help you?'
  },
  zh: {
    providers: 'AI 提供商',
    channels: '消息渠道',
    pluginMarketplace: '插件市场',
    skillMarketplace: '技能市场',
    cron: '定时任务',
    chatWelcome: '你好，有什么可以帮你的吗？'
  }
};

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
    id: 'marketplace-plugins',
    route: '/marketplace/plugins',
    language: 'en',
    waitText: uiText.en.pluginMarketplace,
    outputs: ['images/screenshots/nextclaw-plugins-page.png']
  },
  {
    id: 'marketplace-skills',
    route: '/marketplace/skills',
    language: 'en',
    waitText: uiText.en.skillMarketplace,
    outputs: ['images/screenshots/nextclaw-skills-page.png']
  },
  {
    id: 'cron-jobs',
    route: '/cron',
    language: 'en',
    waitText: uiText.en.cron,
    outputs: ['images/screenshots/nextclaw-cron-job-page.png']
  },
  {
    id: 'chat-home-en',
    route: '/chat',
    language: 'en',
    waitText: uiText.en.chatWelcome,
    outputs: [
      'images/screenshots/nextclaw-chat-page-en.png',
      'images/screenshots/nextclaw-ui-screenshot.png',
      'apps/landing/public/nextclaw-chat-page-en.png'
    ]
  },
  {
    id: 'chat-home-zh',
    route: '/chat',
    language: 'zh',
    waitText: uiText.zh.chatWelcome,
    outputs: [
      'images/screenshots/nextclaw-chat-page-cn.png',
      'apps/landing/public/nextclaw-chat-page-cn.png'
    ]
  },
  {
    id: 'skills-detail-en',
    route: '/marketplace/skills',
    language: 'en',
    waitText: uiText.en.skillMarketplace,
    afterLoad: async ({ page }) => {
      const firstSkillCard = page.locator('article').first();
      await firstSkillCard.waitFor({ timeout: 10_000 });
      await firstSkillCard.click();
      await page.locator('iframe[src^="data:text/html"]').first().waitFor({ timeout: 10_000 });
    },
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
    afterLoad: async ({ page }) => {
      const firstSkillCard = page.locator('article').first();
      await firstSkillCard.waitFor({ timeout: 10_000 });
      await firstSkillCard.click();
      await page.locator('iframe[src^="data:text/html"]').first().waitFor({ timeout: 10_000 });
    },
    outputs: [
      'images/screenshots/nextclaw-skills-doc-browser-cn.png',
      'apps/landing/public/nextclaw-skills-doc-browser-cn.png'
    ]
  }
];

const providerSpecs = [
  {
    name: 'openai',
    displayName: 'OpenAI',
    modelPrefix: 'openai',
    keywords: ['openai', 'gpt'],
    envKey: 'OPENAI_API_KEY',
    defaultApiBase: 'https://api.openai.com/v1',
    defaultModels: ['openai/gpt-5.1', 'openai/gpt-4.1'],
    supportsWireApi: true,
    wireApiOptions: ['auto', 'chat', 'responses'],
    defaultWireApi: 'auto'
  },
  {
    name: 'anthropic',
    displayName: 'Anthropic',
    modelPrefix: 'anthropic',
    keywords: ['anthropic', 'claude'],
    envKey: 'ANTHROPIC_API_KEY',
    defaultApiBase: 'https://api.anthropic.com/v1',
    defaultModels: ['anthropic/claude-opus-4-1'],
    supportsWireApi: true,
    wireApiOptions: ['auto', 'chat', 'responses'],
    defaultWireApi: 'auto'
  },
  {
    name: 'deepseek',
    displayName: 'DeepSeek',
    modelPrefix: 'deepseek',
    keywords: ['deepseek'],
    envKey: 'DEEPSEEK_API_KEY',
    defaultApiBase: 'https://api.deepseek.com/v1',
    defaultModels: ['deepseek/deepseek-chat'],
    supportsWireApi: true,
    wireApiOptions: ['auto', 'chat', 'responses'],
    defaultWireApi: 'auto'
  },
  {
    name: 'openrouter',
    displayName: 'OpenRouter',
    modelPrefix: 'openrouter',
    keywords: ['openrouter'],
    envKey: 'OPENROUTER_API_KEY',
    defaultApiBase: 'https://openrouter.ai/api/v1',
    defaultModels: ['openrouter/openai/gpt-5.3-codex'],
    supportsWireApi: true,
    wireApiOptions: ['auto', 'chat', 'responses'],
    defaultWireApi: 'auto'
  }
];

const channelSpecs = [
  {
    name: 'discord',
    displayName: 'Discord',
    enabled: true,
    tutorialUrls: {
      en: 'https://docs.nextclaw.io/en/guide/tutorials/feishu',
      zh: 'https://docs.nextclaw.io/zh/guide/tutorials/feishu'
    }
  },
  {
    name: 'telegram',
    displayName: 'Telegram',
    enabled: true
  },
  {
    name: 'feishu',
    displayName: 'Feishu',
    enabled: true
  },
  {
    name: 'qq',
    displayName: 'QQ',
    enabled: true
  },
  {
    name: 'email',
    displayName: 'Email',
    enabled: false
  },
  {
    name: 'wecom',
    displayName: 'WeCom',
    enabled: false
  }
];

const configPayload = {
  agents: {
    defaults: {
      model: 'openai/gpt-5.1',
      workspace: '~/workspace-nextclaw',
      contextTokens: 64000,
      maxToolIterations: 1000
    },
    list: [
      {
        id: 'default',
        default: true,
        model: 'openai/gpt-5.1'
      }
    ]
  },
  providers: {
    openai: {
      apiKeySet: true,
      apiKeyMasked: 'sk-****',
      apiBase: 'https://api.openai.com/v1',
      wireApi: 'auto',
      models: ['openai/gpt-5.1', 'openai/gpt-4.1']
    },
    anthropic: {
      apiKeySet: true,
      apiKeyMasked: 'sk-ant-****',
      apiBase: 'https://api.anthropic.com/v1',
      wireApi: 'auto',
      models: ['anthropic/claude-opus-4-1']
    },
    deepseek: {
      apiKeySet: false,
      apiBase: 'https://api.deepseek.com/v1',
      wireApi: 'auto',
      models: ['deepseek/deepseek-chat']
    },
    openrouter: {
      apiKeySet: true,
      apiKeyMasked: 'sk-or-****',
      apiBase: 'https://openrouter.ai/api/v1',
      wireApi: 'responses',
      models: ['openrouter/openai/gpt-5.3-codex']
    }
  },
  channels: {
    discord: {
      enabled: true,
      token: '',
      allowBots: false,
      dmPolicy: 'pairing',
      groupPolicy: 'allowlist'
    },
    telegram: {
      enabled: true,
      token: '',
      dmPolicy: 'open',
      groupPolicy: 'allowlist'
    },
    feishu: {
      enabled: true,
      appId: '',
      appSecret: ''
    },
    qq: {
      enabled: true,
      appId: '',
      markdownSupport: true
    },
    email: {
      enabled: false,
      consentGranted: false
    },
    wecom: {
      enabled: false,
      corpId: '',
      agentId: ''
    }
  },
  session: {
    dmScope: 'per-channel-peer'
  },
  bindings: [],
  secrets: {
    enabled: true,
    defaults: {
      env: 'global'
    },
    providers: {
      global: {
        source: 'env',
        prefix: 'NEXTCLAW_'
      }
    },
    refs: {}
  }
};

const schemaPayload = {
  schema: {
    type: 'object',
    properties: {}
  },
  uiHints: {
    'providers.openai': {
      help: 'OpenAI official endpoint with Responses API support.'
    },
    'channels.discord': {
      help: 'Connect Discord bot and forward mentions to your agent.'
    },
    'channels.telegram': {
      help: 'Connect Telegram bot token and manage DM/group policy.'
    }
  },
  actions: [],
  version: 'screenshot-mock-v1',
  generatedAt: new Date().toISOString()
};

const marketplacePlugins = [
  {
    id: 'plugin-nextclaw-web-search',
    slug: 'web-search',
    type: 'plugin',
    name: 'Web Search',
    summary: 'Search the web directly from your agent workflow.',
    summaryI18n: {
      en: 'Search the web directly from your agent workflow.',
      zh: '在 Agent 工作流中直接进行网页搜索。'
    },
    tags: ['search', 'tooling'],
    author: 'NextClaw',
    install: {
      kind: 'npm',
      spec: '@nextclaw/plugin-web-search',
      command: 'npm i @nextclaw/plugin-web-search'
    },
    updatedAt: '2026-03-05T00:00:00.000Z',
    publishedAt: '2026-03-01T00:00:00.000Z'
  },
  {
    id: 'plugin-nextclaw-github',
    slug: 'github',
    type: 'plugin',
    name: 'GitHub Toolkit',
    summary: 'Read issues, PRs, and repository metadata.',
    summaryI18n: {
      en: 'Read issues, PRs, and repository metadata.',
      zh: '读取 Issue、PR 与仓库元数据。'
    },
    tags: ['github', 'dev'],
    author: 'NextClaw',
    install: {
      kind: 'npm',
      spec: '@nextclaw/plugin-github',
      command: 'npm i @nextclaw/plugin-github'
    },
    updatedAt: '2026-03-04T00:00:00.000Z',
    publishedAt: '2026-03-02T00:00:00.000Z'
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

const installedPluginRecords = [
  {
    type: 'plugin',
    id: 'plugin-nextclaw-web-search',
    spec: '@nextclaw/plugin-web-search',
    label: 'Web Search',
    installedAt: '2026-03-05T01:00:00.000Z',
    enabled: true,
    runtimeStatus: 'running',
    origin: 'workspace'
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

function ok(data) {
  return {
    status: 200,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify({ ok: true, data })
  };
}

function fail(status, message) {
  return {
    status,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify({ ok: false, error: { code: `E${status}`, message } })
  };
}

function listPayload(items, searchParams) {
  const page = Number(searchParams.get('page') || 1);
  const pageSize = Number(searchParams.get('pageSize') || 10);
  return {
    total: items.length,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(items.length / Math.max(1, pageSize))),
    sort: searchParams.get('sort') || 'relevance',
    query: searchParams.get('q') || undefined,
    items
  };
}

function matchItemBySlug(items, slug) {
  return items.find((item) => item.slug === slug) || null;
}

function resolveMock(pathname, searchParams, method) {
  if (method === 'GET' && pathname === '/api/config') {
    return ok(configPayload);
  }

  if (method === 'GET' && pathname === '/api/config/meta') {
    return ok({ providers: providerSpecs, channels: channelSpecs });
  }

  if (method === 'GET' && pathname === '/api/config/schema') {
    return ok(schemaPayload);
  }

  if (method === 'GET' && pathname === '/api/sessions') {
    return ok({ sessions: [], total: 0 });
  }

  if (method === 'GET' && /^\/api\/sessions\/[^/]+\/history$/.test(pathname)) {
    const sessionKey = decodeURIComponent(pathname.split('/')[3] || 'demo');
    return ok({
      key: sessionKey,
      totalMessages: 0,
      totalEvents: 0,
      metadata: {},
      messages: [],
      events: []
    });
  }

  if (method === 'GET' && pathname === '/api/chat/capabilities') {
    return ok({ stopSupported: true });
  }

  if (method === 'GET' && pathname === '/api/chat/runs') {
    return ok({ runs: [], total: 0 });
  }

  if (method === 'GET' && pathname.startsWith('/api/chat/runs/')) {
    const runId = decodeURIComponent(pathname.slice('/api/chat/runs/'.length));
    return ok({
      runId,
      sessionKey: 'demo',
      state: 'completed',
      requestedAt: '2026-03-05T01:00:00.000Z',
      completedAt: '2026-03-05T01:00:01.000Z',
      stopSupported: true,
      eventCount: 0,
      reply: ''
    });
  }

  if (method === 'GET' && pathname === '/api/cron') {
    return ok({ jobs: cronJobs, total: cronJobs.length });
  }

  if (method === 'GET' && pathname === '/api/marketplace/plugins/items') {
    return ok(listPayload(marketplacePlugins, searchParams));
  }

  if (method === 'GET' && pathname === '/api/marketplace/skills/items') {
    return ok(listPayload(marketplaceSkills, searchParams));
  }

  if (method === 'GET' && pathname === '/api/marketplace/plugins/recommendations') {
    return ok({
      type: 'plugin',
      sceneId: searchParams.get('scene') || 'default',
      title: 'Recommended Plugins',
      description: 'Curated plugin list',
      total: marketplacePlugins.length,
      items: marketplacePlugins
    });
  }

  if (method === 'GET' && pathname === '/api/marketplace/skills/recommendations') {
    return ok({
      type: 'skill',
      sceneId: searchParams.get('scene') || 'default',
      title: 'Recommended Skills',
      description: 'Curated skill list',
      total: marketplaceSkills.length,
      items: marketplaceSkills
    });
  }

  if (method === 'GET' && pathname === '/api/marketplace/plugins/installed') {
    return ok({
      type: 'plugin',
      total: installedPluginRecords.length,
      specs: installedPluginRecords.map((record) => record.spec),
      records: installedPluginRecords
    });
  }

  if (method === 'GET' && pathname === '/api/marketplace/skills/installed') {
    return ok({
      type: 'skill',
      total: installedSkillRecords.length,
      specs: installedSkillRecords.map((record) => record.spec),
      records: installedSkillRecords
    });
  }

  const pluginItemMatch = pathname.match(/^\/api\/marketplace\/plugins\/items\/([^/]+)$/);
  if (method === 'GET' && pluginItemMatch) {
    const slug = decodeURIComponent(pluginItemMatch[1]);
    const item = matchItemBySlug(marketplacePlugins, slug);
    if (!item) {
      return fail(404, `Plugin not found: ${slug}`);
    }
    return ok({
      ...item,
      description: item.summary,
      descriptionI18n: item.summaryI18n,
      sourceRepo: 'https://github.com/nextclaw/plugins'
    });
  }

  const skillItemMatch = pathname.match(/^\/api\/marketplace\/skills\/items\/([^/]+)$/);
  if (method === 'GET' && skillItemMatch) {
    const slug = decodeURIComponent(skillItemMatch[1]);
    const item = matchItemBySlug(marketplaceSkills, slug);
    if (!item) {
      return fail(404, `Skill not found: ${slug}`);
    }
    return ok({
      ...item,
      description: item.summary,
      descriptionI18n: item.summaryI18n,
      sourceRepo: 'https://github.com/nextclaw/skills'
    });
  }

  const pluginContentMatch = pathname.match(/^\/api\/marketplace\/plugins\/items\/([^/]+)\/content$/);
  if (method === 'GET' && pluginContentMatch) {
    const slug = decodeURIComponent(pluginContentMatch[1]);
    const item = matchItemBySlug(marketplacePlugins, slug);
    if (!item) {
      return fail(404, `Plugin not found: ${slug}`);
    }
    return ok({
      type: 'plugin',
      slug,
      name: item.name,
      install: item.install,
      source: 'repo',
      bodyRaw: item.summary,
      metadataRaw: JSON.stringify(item, null, 2),
      sourceUrl: 'https://github.com/nextclaw/plugins'
    });
  }

  const skillContentMatch = pathname.match(/^\/api\/marketplace\/skills\/items\/([^/]+)\/content$/);
  if (method === 'GET' && skillContentMatch) {
    const slug = decodeURIComponent(skillContentMatch[1]);
    const item = matchItemBySlug(marketplaceSkills, slug);
    if (!item) {
      return fail(404, `Skill not found: ${slug}`);
    }
    return ok({
      type: 'skill',
      slug,
      name: item.name,
      install: item.install,
      source: 'workspace',
      raw: `# ${item.name}\n\n${item.summary}`,
      bodyRaw: item.summary,
      sourceUrl: 'https://github.com/nextclaw/skills'
    });
  }

  if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
    return ok({ saved: true });
  }

  if (method === 'GET') {
    return ok({});
  }

  return fail(405, `Unsupported mock endpoint: ${method} ${pathname}`);
}

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
    type: 'plugin',
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
    await context.addInitScript(
      ({ key, value }) => {
        window.localStorage.setItem(key, value);
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
      },
      { key: languageStorageKey, value: scene.language }
    );

    const page = await context.newPage();
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

    await page.goto(`${uiOrigin}${scene.route}`, { waitUntil: 'domcontentloaded' });

    if (scene.waitText) {
      try {
        await page.getByText(scene.waitText, { exact: true }).first().waitFor({ timeout: 15_000 });
      } catch (error) {
        const bodyText = (await page.textContent('body')) || '';
        const compact = bodyText.replace(/\s+/g, ' ').trim().slice(0, 240);
        console.error(`[screenshot] waitText timeout for ${scene.id}. url=${page.url()} body="${compact}"`);
        throw error;
      }
    }

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
  } finally {
    await context.close();
  }
}

async function main() {
  let uiProcess = null;
  const uiPort = DEFAULT_UI_PORT;
  const resolvedUiOrigin = process.env.SCREENSHOT_UI_ORIGIN || `http://127.0.0.1:${uiPort}`;

  try {
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
      for (const scene of scenes) {
        console.log(`[screenshot] capturing ${scene.id}`);
        await captureScene(browser, scene, resolvedUiOrigin);
      }
    } finally {
      await browser.close();
    }

    console.log(`[screenshot] done. generated ${scenes.length} scenes.`);
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
