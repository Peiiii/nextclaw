import { resolveLocalPanelMock } from './product-screenshot-local-panel-mocks.utils.mjs';
import { fail, ok } from './product-screenshot-response.utils.mjs';

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

function resolveStaticMock({ method, pathname, staticGetMocks }) {
  if (method !== 'GET') {
    return null;
  }
  const staticPayload = staticGetMocks.get(pathname);
  return staticPayload ? ok(staticPayload) : null;
}

function resolveSessionHistoryMock({ method, pathname }) {
  if (method !== 'GET' || !/^\/api\/sessions\/[^/]+\/history$/.test(pathname)) {
    return null;
  }
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

function resolveChatRunMock({ method, pathname }) {
  if (method !== 'GET' || !pathname.startsWith('/api/chat/runs/')) {
    return null;
  }
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

function resolveMarketplaceCatalogMock({ marketplaceSkills, method, pathname, searchParams }) {
  if (method === 'GET' && pathname === '/api/marketplace/skills/items') {
    return ok(listPayload(marketplaceSkills, searchParams));
  }
  if (method !== 'GET' || pathname !== '/api/marketplace/skills/recommendations') {
    return null;
  }
  return ok({
    type: 'skill',
    sceneId: searchParams.get('scene') || 'default',
    title: 'Recommended Skills',
    description: 'Curated skill list',
    total: marketplaceSkills.length,
    items: marketplaceSkills
  });
}

function resolveMarketplaceItemMock({ marketplaceSkills, method, pathname }) {
  const skillItemMatch = pathname.match(/^\/api\/marketplace\/skills\/items\/([^/]+)$/);
  if (method !== 'GET' || !skillItemMatch) {
    return null;
  }
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

function resolveMarketplaceContentMock({ marketplaceSkills, method, pathname }) {
  const skillContentMatch = pathname.match(/^\/api\/marketplace\/skills\/items\/([^/]+)\/content$/);
  if (method !== 'GET' || !skillContentMatch) {
    return null;
  }
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

function resolveDefaultMutationMock({ method }) {
  return method === 'POST' || method === 'PUT' || method === 'DELETE'
    ? ok({ saved: true })
    : null;
}

function resolveDefaultGetMock({ method }) {
  return method === 'GET' ? ok({}) : null;
}

export function createScreenshotRouteMockResolver({ localPanels, marketplaceSkills, staticGetMocks }) {
  const resolvers = [
    (params) => resolveStaticMock({ ...params, staticGetMocks }),
    (params) => resolveLocalPanelMock({ ...params, localPanels }),
    resolveSessionHistoryMock,
    resolveChatRunMock,
    (params) => resolveMarketplaceCatalogMock({ ...params, marketplaceSkills }),
    (params) => resolveMarketplaceItemMock({ ...params, marketplaceSkills }),
    (params) => resolveMarketplaceContentMock({ ...params, marketplaceSkills }),
    resolveDefaultMutationMock,
    resolveDefaultGetMock
  ];

  return (pathname, searchParams, method) => {
    const params = { method, pathname, searchParams };
    for (const resolve of resolvers) {
      const response = resolve(params);
      if (response) {
        return response;
      }
    }
    return fail(405, `Unsupported mock endpoint: ${method} ${pathname}`);
  };
}
