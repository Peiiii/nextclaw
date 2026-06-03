import { describe, expect, it } from 'vitest';
import type { PanelAppEntryView } from '@/shared/lib/api';
import { getPanelAppViewEntries } from './panel-app-view.utils';

function createPanelAppEntry(overrides: Partial<PanelAppEntryView> = {}): PanelAppEntryView {
  const createdAt = overrides.createdAt ?? '2026-05-01T00:00:00.000Z';
  const updatedAt = overrides.updatedAt ?? createdAt;
  return {
    id: overrides.id ?? overrides.fileName ?? 'demo.panel.html',
    appId: overrides.appId ?? 'demo',
    fileName: overrides.fileName ?? 'demo.panel.html',
    kind: overrides.kind ?? 'single-file',
    title: overrides.title ?? 'Demo',
    contentPath: overrides.contentPath ?? '/api/panel-apps/demo/content',
    createdAt,
    updatedAt,
    sizeBytes: overrides.sizeBytes ?? 12,
    favorite: overrides.favorite ?? false,
    clientDeclared: overrides.clientDeclared ?? false,
    clientGranted: overrides.clientGranted ?? false,
    openCount: overrides.openCount ?? 0,
    ...overrides,
  };
}

describe('panel app view sorting', () => {
  it('orders smart view by the latest panel app activity before favorite state', () => {
    const entries = [
      createPanelAppEntry({
        fileName: 'old-favorite.panel.html',
        title: 'Old Favorite',
        favorite: true,
      }),
      createPanelAppEntry({
        fileName: 'newly-created.panel.html',
        title: 'Newly Created',
        createdAt: '2026-05-27T12:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
      }),
      createPanelAppEntry({
        fileName: 'just-opened.panel.html',
        title: 'Just Opened',
        lastOpenedAt: '2026-05-28T08:00:00.000Z',
      }),
    ];

    expect(getPanelAppViewEntries(entries, 'smart').map((entry) => entry.fileName)).toEqual([
      'just-opened.panel.html',
      'newly-created.panel.html',
      'old-favorite.panel.html',
    ]);
  });

  it('keeps the dedicated recent-open view scoped to apps that were opened', () => {
    const entries = [
      createPanelAppEntry({
        fileName: 'newly-created.panel.html',
        createdAt: '2026-05-27T12:00:00.000Z',
      }),
      createPanelAppEntry({
        fileName: 'just-opened.panel.html',
        lastOpenedAt: '2026-05-28T08:00:00.000Z',
      }),
    ];

    expect(getPanelAppViewEntries(entries, 'recent-open').map((entry) => entry.fileName)).toEqual([
      'just-opened.panel.html',
    ]);
  });
});
