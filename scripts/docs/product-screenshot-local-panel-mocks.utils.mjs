import { fail, ok, raw } from './product-screenshot-response.utils.mjs';

function resolvePanelCatalogMock({ localPanels, method, pathname }) {
  if (method === 'GET' && pathname === '/api/panel-apps') {
    return ok(localPanels.panelListView);
  }
  return null;
}

function resolvePanelContentMock({ localPanels, method, pathname }) {
  const panelContentMatch = pathname.match(/^\/api\/panel-apps\/([^/]+)\/content$/);
  if (method === 'GET' && panelContentMatch) {
    const appId = decodeURIComponent(panelContentMatch[1]);
    const html = localPanels.findPanelContent(appId);
    return html
      ? raw(200, 'text/html; charset=utf-8', html)
      : fail(404, `Panel app not found: ${appId}`);
  }
  return null;
}

function resolvePanelAssetMock({ localPanels, method, pathname }) {
  const panelAssetMatch = pathname.match(/^\/api\/panel-apps\/([^/]+)\/assets\/(.+)$/);
  if (method === 'GET' && panelAssetMatch) {
    const appId = decodeURIComponent(panelAssetMatch[1]);
    const assetPath = decodeURIComponent(panelAssetMatch[2]);
    const asset = localPanels.findPanelAsset(appId, assetPath);
    return asset
      ? raw(200, asset.contentType, asset.content)
      : fail(404, `Panel app asset not found: ${appId}/${assetPath}`);
  }
  return null;
}

function resolvePanelBridgeMock({ method, pathname }) {
  if (method === 'GET' && (pathname === '/api/panel-app-bridge.js' || pathname === '/api/panel-app-client-sdk.js')) {
    return raw(200, 'application/javascript; charset=utf-8', '');
  }
  return null;
}

function resolveNcpSessionMock({ localPanels, method, pathname }) {
  if (method === 'GET' && pathname === '/api/ncp/sessions') {
    return ok(localPanels.sessionList);
  }
  if (method === 'GET' && pathname === `/api/ncp/sessions/${localPanels.workspaceSessionId}/messages`) {
    return ok(localPanels.sessionMessages);
  }
  if (method === 'GET' && pathname === `/api/ncp/sessions/${localPanels.workspaceSessionId}/skills`) {
    return ok({ records: [], total: 0 });
  }
  return null;
}

function resolveServerPathMock({ localPanels, method, pathname, searchParams }) {
  if (method === 'GET' && pathname === '/api/server-paths/read') {
    const payload = localPanels.readServerPath({
      path: searchParams.get('path') || '',
      basePath: searchParams.get('basePath') || ''
    });
    return payload ? ok(payload) : fail(404, 'File not found');
  }

  if (method === 'GET' && pathname === '/api/server-paths/browse') {
    const payload = localPanels.browseServerPath({
      path: searchParams.get('path') || '',
      basePath: searchParams.get('basePath') || '',
      includeFiles: searchParams.get('includeFiles') === 'true'
    });
    return payload ? ok(payload) : fail(404, 'Directory not found');
  }

  if (method === 'GET' && pathname.startsWith('/api/server-paths/content/')) {
    const html = localPanels.readServerContent(pathname);
    return html ? raw(200, 'text/html; charset=utf-8', html) : fail(404, 'Content not found');
  }
  return null;
}

export function resolveLocalPanelMock(params) {
  const resolvers = [
    resolvePanelCatalogMock,
    resolvePanelContentMock,
    resolvePanelAssetMock,
    resolvePanelBridgeMock,
    resolveNcpSessionMock,
    resolveServerPathMock
  ];
  for (const resolve of resolvers) {
    const response = resolve(params);
    if (response) {
      return response;
    }
  }
  return null;
}
