import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PanelAppToolbar } from '@/features/panel-apps/components/panel-app-toolbar';

const mainSidebarMutation = vi.hoisted(() => ({
  isPending: false,
  mutate: vi.fn(),
}));

vi.mock('@/features/panel-apps/hooks/use-panel-apps', () => ({
  usePanelApps: vi.fn(),
  useUpdatePanelAppPreferences: () => mainSidebarMutation,
}));

const entry = {
  appId: 'ink-assistant',
  clientDeclared: false,
  clientGranted: false,
  contentPath: '/api/panel-apps/ink-assistant/content',
  createdAt: '2026-08-19T00:00:00.000Z',
  favorite: false,
  fileName: 'ink-assistant.panel.html',
  id: 'ink-assistant',
  kind: 'single-file' as const,
  mainSidebar: false,
  openCount: 0,
  sizeBytes: 10,
  title: '墨爪助手',
  updatedAt: '2026-08-19T00:00:00.000Z',
};

describe('PanelAppToolbar', () => {
  beforeEach(() => {
    mainSidebarMutation.isPending = false;
    mainSidebarMutation.mutate.mockReset();
  });

  it('keeps placement in the overflow menu without adding a second back action', async () => {
    const user = userEvent.setup();
    render(
      <PanelAppToolbar
        appTitle="墨爪助手"
        entry={entry}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByText('墨爪助手')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Apps' })).toBeNull();

    expect(screen.queryByRole('button', { name: 'Add to main sidebar' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'More panel app actions' }));
    const addButton = screen.getByRole('button', { name: 'Add to main sidebar' });
    expect(addButton.getAttribute('aria-pressed')).toBe('false');
    await user.click(addButton);

    expect(mainSidebarMutation.mutate).toHaveBeenCalledWith({
      id: 'ink-assistant',
      preferences: { mainSidebar: true },
    });
    expect(screen.queryByRole('button', { name: 'Add to main sidebar' })).toBeNull();
  });

  it('uses the same menu item to remove an app already in the main sidebar', async () => {
    const user = userEvent.setup();
    render(
      <PanelAppToolbar
        appTitle="墨爪助手"
        entry={{ ...entry, mainSidebar: true }}
        onRefresh={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'More panel app actions' }));
    const removeButton = screen.getByRole('button', { name: 'Remove from main sidebar' });
    expect(removeButton.getAttribute('aria-pressed')).toBe('true');
    await user.click(removeButton);

    expect(mainSidebarMutation.mutate).toHaveBeenCalledWith({
      id: 'ink-assistant',
      preferences: { mainSidebar: false },
    });
  });
});
