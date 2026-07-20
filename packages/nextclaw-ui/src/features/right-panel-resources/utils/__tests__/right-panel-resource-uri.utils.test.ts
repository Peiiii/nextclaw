import { describe, expect, it } from 'vitest';
import type { PanelAppEntryView } from '@/shared/lib/api';
import {
  createPanelAppContentPath,
  createPanelAppResourceUri,
  createPanelAppRightPanelResourceTarget,
} from '@/features/right-panel-resources/utils/right-panel-resource-uri.utils';

function createPanelAppEntry(overrides: Partial<PanelAppEntryView> = {}): PanelAppEntryView {
  return {
    appId: 'demo',
    clientDeclared: false,
    clientGranted: false,
    contentPath: '/api/panel-apps/demo/content',
    createdAt: '2026-06-02T00:00:00.000Z',
    favorite: false,
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
  it('builds matching external panel app resource and content URLs', () => {
    expect(createPanelAppResourceUri('demo', '/tmp/demo.panel')).toBe(
      'nextclaw://panel-app/demo?path=%2Ftmp%2Fdemo.panel',
    );
    expect(createPanelAppContentPath('demo', '/tmp/demo.panel')).toBe(
      '/api/panel-apps/demo/content?path=%2Ftmp%2Fdemo.panel',
    );
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
});
