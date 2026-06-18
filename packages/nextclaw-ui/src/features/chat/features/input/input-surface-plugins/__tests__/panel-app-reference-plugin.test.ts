import { describe, expect, it } from 'vitest';
import { resolveChatInputSurfaceState } from '@nextclaw/agent-chat-ui';
import { createPanelAppReferenceInputSurfacePlugin, PANEL_APP_REFERENCE_TRIGGER_SPEC } from '@/features/chat/features/input/input-surface-plugins/panel-app-reference-plugin.utils';
import type { PanelAppEntryView } from '@/shared/lib/api';

function createPanelApp(overrides: Partial<PanelAppEntryView> & Pick<PanelAppEntryView, 'appId' | 'title'>): PanelAppEntryView {
  return {
    id: overrides.id ?? overrides.appId,
    appId: overrides.appId,
    fileName: overrides.fileName ?? `${overrides.appId}.panel.html`,
    kind: overrides.kind ?? 'single-file',
    title: overrides.title,
    description: overrides.description,
    contentPath: overrides.contentPath ?? `/panels/${overrides.appId}.panel.html`,
    createdAt: overrides.createdAt ?? '2026-06-18T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-06-18T00:00:00.000Z',
    sizeBytes: overrides.sizeBytes ?? 100,
    favorite: overrides.favorite ?? false,
    clientDeclared: overrides.clientDeclared ?? false,
    clientGranted: overrides.clientGranted ?? false,
    lastOpenedAt: overrides.lastOpenedAt,
    openCount: overrides.openCount ?? 0,
  };
}

describe('panel app reference input surface plugin', () => {
  it('returns panel app reference items for @ trigger queries', () => {
    const plugin = createPanelAppReferenceInputSurfacePlugin({
      itemTexts: {
        appIdLabel: 'App ID',
        fileLabel: 'File',
        noDescriptionLabel: 'No description',
        subtitle: 'Panel App',
      },
      menuTexts: {
        loadingLabel: 'Loading',
        sectionLabel: 'Panel Apps',
        emptyLabel: 'Empty',
        hintLabel: 'Type @',
        itemHintLabel: 'Enter to reference',
      },
    });

    const state = resolveChatInputSurfaceState({
      plugins: [plugin],
      trigger: {
        ...PANEL_APP_REFERENCE_TRIGGER_SPEC,
        query: 'task',
        start: 0,
        end: 5,
      },
      data: {
        isPanelAppsLoading: false,
        isSkillsLoading: false,
        panelApps: [
          createPanelApp({
            appId: 'task-board',
            title: 'Task Board',
            description: 'Track tasks',
          }),
        ],
        recentSkillValues: [],
        skillRecords: [],
      },
    });

    expect(state.panel?.items).toEqual([
      expect.objectContaining({
        key: 'panel-app:task-board',
        title: 'Task Board',
        tokenKind: 'panel_app',
        tokenKey: 'task-board',
        value: 'task-board',
      }),
    ]);
  });
});
