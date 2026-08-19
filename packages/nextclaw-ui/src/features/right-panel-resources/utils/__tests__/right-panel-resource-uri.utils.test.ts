import { describe, expect, it } from 'vitest';
import type { PanelAppEntryView } from '@/shared/lib/api';
import {
  createChatUiResourceReferenceFromTab,
  createPanelAppContentPath,
  createPanelAppResourceUri,
  createPanelAppRightPanelResourceTarget,
  readPanelAppIdFromResourceUri,
} from '@/features/right-panel-resources/utils/right-panel-resource-uri.utils';

function createPanelAppEntry(overrides: Partial<PanelAppEntryView> = {}): PanelAppEntryView {
  return {
    appId: 'demo',
    clientDeclared: false,
    clientGranted: false,
    contentPath: '/api/panel-apps/demo/content',
    createdAt: '2026-06-02T00:00:00.000Z',
    favorite: false,
    mainSidebar: false,
    fileName: 'demo.html',
    id: 'demo',
    kind: 'single-file',
    openCount: 0,
    sizeBytes: 1024,
    title: 'Demo App',
    updatedAt: '2026-06-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('right-panel-resource uri utils', () => {
  it('creates a stable chat reference for an addressable panel tab', () => {
    expect(createChatUiResourceReferenceFromTab({
      id: 'panel-demo',
      kind: 'panel-app',
      title: 'Demo App',
      currentUrl: '/api/panel-apps/demo/content',
      resourceUri: 'nextclaw://panel-app/demo',
      contentParams: { itemId: 'note-1' },
      history: ['/api/panel-apps/demo/content'],
      historyIndex: 0,
      navVersion: 0,
    })).toEqual({
      uri: 'nextclaw://panel-app/demo',
      resourceKind: 'panel-app',
      title: 'Demo App',
      currentUrl: '/api/panel-apps/demo/content',
      contentParams: { itemId: 'note-1' },
    });
  });

  it('does not create chat references for empty browser tabs', () => {
    expect(createChatUiResourceReferenceFromTab({
      id: 'home',
      kind: 'home',
      title: 'Start Page',
      currentUrl: 'nextclaw://new-tab',
      resourceUri: 'nextclaw://new-tab',
      history: ['nextclaw://new-tab'],
      historyIndex: 0,
      navVersion: 0,
    })).toBeNull();
  });

  it('builds matching external panel app resource and content URLs', () => {
    expect(createPanelAppResourceUri('demo', '/tmp/demo.panel')).toBe(
      'nextclaw://panel-app/demo?path=%2Ftmp%2Fdemo.panel',
    );
    expect(createPanelAppContentPath('demo', '/tmp/demo.panel')).toBe(
      '/api/panel-apps/demo/content?path=%2Ftmp%2Fdemo.panel',
    );
  });

  it('reads stable panel app ids from resource and content URLs', () => {
    expect(readPanelAppIdFromResourceUri('nextclaw://panel-app/publisher.todo')).toBe('publisher.todo');
    expect(readPanelAppIdFromResourceUri('/api/panel-apps/publisher.todo/content')).toBe('publisher.todo');
    expect(readPanelAppIdFromResourceUri('nextclaw://panel-app/publisher.todo?path=%2Ftmp%2Ftodo.panel')).toBeNull();
    expect(readPanelAppIdFromResourceUri('nextclaw://apps')).toBeNull();
  });

  it('keeps panel app image icons as dock image icons', () => {
    const target = createPanelAppRightPanelResourceTarget(createPanelAppEntry({
      icon: '/api/panel-apps/demo/assets/icon.png',
    }));

    expect(target.dockIcon).toEqual({
      type: 'url',
      url: '/api/panel-apps/demo/assets/icon.png',
    });
  });

  it('keeps panel app text icons as dock text icons', () => {
    const target = createPanelAppRightPanelResourceTarget(createPanelAppEntry({
      icon: '🧭',
    }));

    expect(target.dockIcon).toEqual({
      type: 'text',
      value: '🧭',
    });
  });

  it('uses the stable app id for persistent panel app resources', () => {
    const target = createPanelAppRightPanelResourceTarget(createPanelAppEntry({
      id: 'installed-directory-name',
      appId: 'publisher.stable-panel',
      contentPath: '/api/panel-apps/publisher.stable-panel/content',
    }));

    expect(target).toEqual(expect.objectContaining({
      dedupeKey: 'panel-app:publisher.stable-panel',
      resourceUri: 'nextclaw://panel-app/publisher.stable-panel',
    }));
  });
});
