import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  browseServerPath,
  readServerContent,
  readServerPath
} from './product-screenshot-server-paths.utils.mjs';

const workspaceSessionId = process.env.SCREENSHOT_WORKSPACE_SESSION_ID || 'screenshot-workspace';
const workspaceStateKey = 'nextclaw.chat.workspace-panel.state';
const docBrowserStateKey = 'nextclaw.doc-browser.state';
const sideDockStateKey = 'nextclaw.side-dock.state';
const viewportLayoutStateKey = 'nextclaw.app.viewport-layout';

const preferredPanelOrder = [
  'piano',
  'music-player',
  'translator',
  'novel-reader',
  'box-breathing',
  'solar-system',
  'agent-ecosystem-dashboard',
  'global-assets-dashboard',
  'mission-control',
  'nextclaw-config-browser',
  'crypto-monitor',
  'markdown-editor',
  'task-board',
  'quick-commands',
  'config-browser',
  'todo-app'
];

function readText(filePath) {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function readJsonObject(filePath) {
  const text = readText(filePath);
  if (!text) {
    return null;
  }
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function statOrNull(filePath) {
  try {
    return statSync(filePath);
  } catch {
    return null;
  }
}

function contentTypeForPath(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case '.css':
      return 'text/css; charset=utf-8';
    case '.gif':
      return 'image/gif';
    case '.html':
      return 'text/html; charset=utf-8';
    case '.jpeg':
    case '.jpg':
      return 'image/jpeg';
    case '.js':
    case '.mjs':
      return 'application/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.mid':
    case '.midi':
      return 'audio/midi';
    case '.png':
      return 'image/png';
    case '.svg':
      return 'image/svg+xml; charset=utf-8';
    case '.wasm':
      return 'application/wasm';
    default:
      return 'application/octet-stream';
  }
}

function safeResolveChildPath(parentPath, childPath) {
  const parent = path.resolve(parentPath);
  const candidate = path.resolve(parent, childPath);
  return candidate === parent || candidate.startsWith(`${parent}${path.sep}`) ? candidate : null;
}

function titleFromSlug(slug) {
  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function extractHtmlMeta(html, name) {
  const pattern = new RegExp(`<meta\\s+[^>]*name=["']${name}["'][^>]*content=["']([^"']+)["'][^>]*>`, 'i');
  return html.match(pattern)?.[1]?.trim() || null;
}

function extractHtmlTitle(html) {
  return extractHtmlMeta(html, 'nextclaw-panel-title') ||
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ||
    null;
}

function normalizeIcon(icon) {
  return typeof icon === 'string' && icon.trim().length > 0 && icon.trim().length <= 4
    ? icon.trim()
    : undefined;
}

function encodePanelEntryId(fileName) {
  return Buffer.from(fileName, 'utf8').toString('base64').replace(/=+$/u, '');
}

function createPanelEntry({
  appId,
  description,
  fileName,
  icon,
  kind,
  sizeBytes,
  title,
  updatedAt
}) {
  const preferredIndex = preferredPanelOrder.indexOf(appId);
  const activityAt = preferredIndex >= 0
    ? new Date(Date.UTC(2026, 6, 7, 2, preferredPanelOrder.length - preferredIndex, 0)).toISOString()
    : updatedAt;
  const id = encodePanelEntryId(fileName);
  return {
    id,
    appId,
    fileName,
    kind,
    title,
    ...(description ? { description } : {}),
    ...(icon ? { icon } : {}),
    contentPath: `/api/panel-apps/${encodeURIComponent(id)}/content`,
    createdAt: updatedAt,
    updatedAt: activityAt,
    sizeBytes,
    favorite: preferredPanelOrder.slice(0, 4).includes(appId),
    clientDeclared: false,
    clientGranted: true,
    lastOpenedAt: activityAt,
    openCount: preferredIndex >= 0 ? preferredPanelOrder.length - preferredIndex : 1
  };
}

function createEnvPanelEntry() {
  const id = process.env.SCREENSHOT_PANEL_APP_ID?.trim();
  const title = process.env.SCREENSHOT_PANEL_APP_TITLE?.trim();
  if (!id || !title) {
    return null;
  }
  const icon = process.env.SCREENSHOT_PANEL_APP_ICON?.trim();
  const now = new Date().toISOString();
  return {
    entry: {
      id,
      appId: id,
      fileName: process.env.SCREENSHOT_PANEL_APP_FILE_NAME?.trim() || `${title}.panel.html`,
      kind: process.env.SCREENSHOT_PANEL_APP_KIND === 'folder' ? 'folder' : 'single-file',
      title,
      ...(icon ? { icon } : {}),
      contentPath: `/api/panel-apps/${encodeURIComponent(id)}/content`,
      createdAt: now,
      updatedAt: now,
      sizeBytes: 0,
      favorite: false,
      clientDeclared: false,
      clientGranted: true,
      lastOpenedAt: now,
      openCount: 1
    },
    filePath: '',
    html: ''
  };
}

function collectSingleFilePanel(panelsPath, fileName) {
  const appId = fileName.replace(/\.panel\.html$/u, '');
  const filePath = path.join(panelsPath, fileName);
  const html = readText(filePath);
  const fileStat = statOrNull(filePath);
  if (!html || !fileStat) {
    return null;
  }
  return {
    entry: createPanelEntry({
      appId,
      description: extractHtmlMeta(html, 'nextclaw-panel-description') || undefined,
      fileName,
      kind: 'single-file',
      sizeBytes: fileStat.size,
      title: extractHtmlTitle(html) || titleFromSlug(appId),
      updatedAt: fileStat.mtime.toISOString()
    }),
    filePath,
    html
  };
}

function collectFolderPanel(panelsPath, folderName) {
  const appId = folderName.replace(/\.panel$/u, '');
  const folderPath = path.join(panelsPath, folderName);
  const manifest = readJsonObject(path.join(folderPath, 'panel-app.json'));
  if (!manifest) {
    return null;
  }
  const entryFile = typeof manifest.entry === 'string' && manifest.entry.trim() ? manifest.entry.trim() : 'index.html';
  const filePath = path.join(folderPath, entryFile);
  const html = readText(filePath);
  const fileStat = statOrNull(filePath);
  if (!html || !fileStat) {
    return null;
  }
  return {
    entry: createPanelEntry({
      appId,
      description: typeof manifest.description === 'string' ? manifest.description : undefined,
      fileName: folderName,
      icon: normalizeIcon(manifest.icon),
      kind: 'folder',
      sizeBytes: fileStat.size,
      title: typeof manifest.title === 'string' && manifest.title.trim() ? manifest.title.trim() : titleFromSlug(appId),
      updatedAt: fileStat.mtime.toISOString()
    }),
    filePath,
    html
  };
}

function comparePanelEntries(left, right) {
  const leftOrder = preferredPanelOrder.indexOf(left.entry.appId);
  const rightOrder = preferredPanelOrder.indexOf(right.entry.appId);
  return (leftOrder < 0 ? 999 : leftOrder) - (rightOrder < 0 ? 999 : rightOrder) ||
    left.entry.title.localeCompare(right.entry.title);
}

function loadPanelCatalog(workspacePath) {
  const panelsPath = path.join(workspacePath, 'panels');
  if (!existsSync(panelsPath)) {
    return { workspacePath, panelsPath, panels: [] };
  }
  const panels = readdirSync(panelsPath)
    .map((fileName) => {
      if (fileName.endsWith('.panel.html')) {
        return collectSingleFilePanel(panelsPath, fileName);
      }
      if (fileName.endsWith('.panel')) {
        return collectFolderPanel(panelsPath, fileName);
      }
      return null;
    })
    .filter(Boolean)
    .sort(comparePanelEntries);
  return { workspacePath, panelsPath, panels };
}

function createDocBrowserTab(entry, language = 'en') {
  const currentUrl = entry
    ? entry.contentPath
    : 'nextclaw://apps';
  const id = entry ? `doc-tab-panel-${entry.id}` : 'doc-tab-apps';
  const kind = entry ? 'panel-app' : 'apps';
  const resourceUri = entry ? `nextclaw://panel-app/${encodeURIComponent(entry.id)}` : 'nextclaw://apps';
  return {
    id,
    kind,
    title: entry?.title || (language === 'zh' ? '应用' : 'Apps'),
    currentUrl,
    resourceUri,
    ...(entry ? { dedupeKey: `panel-app:${entry.id}`, dockIcon: entry.icon ? { type: 'text', value: entry.icon } : undefined } : { dedupeKey: 'apps' }),
    history: [currentUrl],
    historyIndex: 0,
    navVersion: 0
  };
}

function createDocBrowserStorage(entry = null, language = 'en') {
  const tab = createDocBrowserTab(entry, language);
  return JSON.stringify({
    state: {
      snapshot: {
        isOpen: true,
        mode: 'docked',
        tabs: [tab],
        activeTabId: tab.id,
        activeHistory: [{ kind: tab.kind, resourceUri: tab.resourceUri, tabId: tab.id, url: tab.currentUrl }],
        activeHistoryIndex: 0
      }
    },
    version: 1
  });
}

function createWorkspacePanelStorage({ htmlPath, htmlText, repoRoot }) {
  const markdownPath = path.join(repoRoot, 'docs/VISION.md');
  const sourcePath = path.join(repoRoot, 'apps/landing/src/main.ts');
  const htmlKey = `${workspaceSessionId}::preview:rendered::${htmlPath}`;
  const fileTabs = [
    {
      key: `${workspaceSessionId}::preview::${sourcePath}`,
      parentSessionKey: workspaceSessionId,
      path: sourcePath,
      label: 'main.ts',
      viewMode: 'preview',
      previewViewer: 'source'
    },
    {
      key: `${workspaceSessionId}::preview::${markdownPath}`,
      parentSessionKey: workspaceSessionId,
      path: markdownPath,
      label: 'VISION.md',
      viewMode: 'preview',
      previewViewer: 'source',
      rawText: readText(markdownPath)
    },
    {
      key: htmlKey,
      parentSessionKey: workspaceSessionId,
      path: htmlPath,
      label: path.basename(htmlPath),
      viewMode: 'preview',
      previewViewer: 'rendered',
      rawText: htmlText
    }
  ];
  return JSON.stringify({
    state: {
      snapshot: {
        workspacePanelParentKey: workspaceSessionId,
        activeWorkspacePanelKind: 'file',
        activeChildSessionKey: null,
        workspaceFileTabs: fileTabs,
        activeWorkspaceFileKey: htmlKey,
        workspaceNavigationHistory: [{ kind: 'file', key: htmlKey }],
        workspaceNavigationHistoryIndex: 0
      }
    },
    version: 2
  });
}

class LocalPanelScreenshotData {
  workspaceSessionId = workspaceSessionId;

  constructor({ repoRoot }) {
    this.repoRoot = repoRoot;
    const workspacePath = process.env.SCREENSHOT_WORKSPACE_ROOT || path.join(process.env.HOME || '', '.nextclaw/workspace');
    const catalog = loadPanelCatalog(workspacePath);
    this.panelById = new Map(catalog.panels.map((panel) => [panel.entry.id, panel]));
    this.panelByAppId = new Map(catalog.panels.map((panel) => [panel.entry.appId, panel]));
    this.selectedPanel = this.selectPanel(catalog);
    this.workspaceHtmlPanel =
      this.panelByAppId.get('agent-ecosystem-dashboard') ||
      this.panelByAppId.get('skill-audit-dashboard') ||
      this.panelByAppId.get('ai-daily-news') ||
      this.panelByAppId.get('crypto-monitor') ||
      this.panelByAppId.get('global-assets-dashboard') ||
      this.panelByAppId.get('task-board') ||
      this.selectedPanel;
    this.panelListView = {
      workspacePath: catalog.workspacePath,
      panelsPath: catalog.panelsPath,
      entries: catalog.panels.map((panel) => panel.entry)
    };
    this.selectedPanelEntry = this.selectedPanel?.entry || null;
    this.sessionList = this.createSessionList();
    this.sessionMessages = this.createSessionMessages();
  }

  selectPanel = (catalog) => {
    const envPanel = createEnvPanelEntry();
    return envPanel || catalog.panels[0] || null;
  };

  createAppsPanelStorage = (language = 'en') => ({
      [docBrowserStateKey]: createDocBrowserStorage(null, language),
      [sideDockStateKey]: JSON.stringify({ state: { isVisible: true, pinnedItems: [] }, version: 1 })
    });

  createPanelAppStorage = (language = 'en') => ({
      [docBrowserStateKey]: createDocBrowserStorage(this.selectedPanel?.entry || null, language),
      [sideDockStateKey]: JSON.stringify({ state: { isVisible: true, pinnedItems: [] }, version: 1 }),
      [viewportLayoutStateKey]: JSON.stringify({ state: { isSidebarCollapsed: true }, version: 1 })
    });

  createWorkspacePreviewStorage = () => ({
      [workspaceStateKey]: createWorkspacePanelStorage({
        htmlPath: this.workspaceHtmlPanel?.filePath || path.join(this.repoRoot, 'apps/landing/index.html'),
        htmlText: this.workspaceHtmlPanel?.html || '',
        repoRoot: this.repoRoot
      })
    });

  findPanelContent = (id) => this.panelById.get(id)?.html || null;

  findPanelAsset = (id, assetPath) => {
    const panel = this.panelById.get(id);
    if (!panel) {
      return null;
    }
    const panelRoot = path.dirname(panel.filePath);
    const assetFilePath = safeResolveChildPath(panelRoot, assetPath);
    if (!assetFilePath) {
      return null;
    }
    try {
      return {
        content: readFileSync(assetFilePath),
        contentType: contentTypeForPath(assetFilePath)
      };
    } catch {
      return null;
    }
  };

  readServerContent = (pathname) => readServerContent(pathname);

  readServerPath = (params) => readServerPath({ ...params, repoRoot: this.repoRoot });

  browseServerPath = (params) => browseServerPath({ ...params, repoRoot: this.repoRoot });

  createSessionList = () => {
    const now = '2026-07-07T02:00:00.000Z';
    return {
      sessions: [{
        sessionId: workspaceSessionId,
        agentId: 'main',
        status: 'idle',
        createdAt: now,
        updatedAt: now,
        lastMessageAt: now,
        messageCount: 2,
        workingDir: this.repoRoot,
        metadata: {
          label: 'AI Agent 生态数据分析',
          project_root: this.repoRoot,
          preferred_model: 'MiniMax/MiniMax-M3',
          last_activity_preview: {
            state: 'completed',
            timestamp: now,
            replyText: '已打开本地 HTML 仪表盘、源码和产品文档。'
          }
        }
      }],
      total: 1
    };
  };

  createSessionMessages = () => {
    const now = '2026-07-07T02:00:00.000Z';
    return {
      sessionId: workspaceSessionId,
      status: 'idle',
      total: 2,
      messages: [
        {
          id: 'workspace-demo-user',
          sessionId: workspaceSessionId,
          role: 'user',
          status: 'completed',
          timestamp: now,
          parts: [{ type: 'text', text: '打开 AI Agent 生态仪表盘、源码和产品文档，我想边看边继续分析。' }]
        },
        {
          id: 'workspace-demo-assistant',
          sessionId: workspaceSessionId,
          role: 'assistant',
          status: 'completed',
          timestamp: now,
          parts: [{ type: 'text', text: '右侧已打开本地 HTML 仪表盘；需要看源码或文档时，可以在上方标签切换。' }]
        }
      ]
    };
  };
}

export function createLocalPanelScreenshotData({ repoRoot }) {
  return new LocalPanelScreenshotData({ repoRoot });
}
