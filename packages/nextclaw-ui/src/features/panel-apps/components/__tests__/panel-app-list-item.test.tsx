import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PanelAppListItem } from '@/features/panel-apps/components/panel-app-list-item';

const baseEntry = {
  id: 'demo',
  appId: 'demo',
  fileName: 'demo.panel.html',
  kind: 'single-file' as const,
  title: 'Demo Panel',
  description: 'A compact panel app with a longer description that should stay on one line.',
  contentPath: '/api/panel-apps/demo/content',
  createdAt: '2026-05-28T08:00:00.000Z',
  updatedAt: '2026-05-28T09:00:00.000Z',
  sizeBytes: 12,
  favorite: false,
  mainSidebar: false,
  clientDeclared: false,
  clientGranted: false,
  openCount: 0,
};

describe('PanelAppListItem', () => {
  it('keeps panel app metadata compact below the icon-title row', () => {
    const { container } = render(
      <PanelAppListItem
        deletePending={false}
        entry={baseEntry}
        favoritePending={false}
        mainSidebarPending={false}
        onDelete={vi.fn()}
        onOpen={vi.fn()}
        onToggleFavorite={vi.fn()}
        onToggleMainSidebar={vi.fn()}
      />,
    );

    expect(screen.getByText(baseEntry.description).className).toContain('truncate');
    expect(container.querySelector('.line-clamp-2')).toBeNull();
  });

  it('opens delete from the more-actions menu only after confirmation', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <PanelAppListItem
        deletePending={false}
        entry={baseEntry}
        favoritePending={false}
        mainSidebarPending={false}
        onDelete={onDelete}
        onOpen={vi.fn()}
        onToggleFavorite={vi.fn()}
        onToggleMainSidebar={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'More panel app actions' }));
    await user.click(screen.getByRole('button', { name: 'Delete panel app' }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText('Delete panel app?')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('keeps main-sidebar placement in the low-frequency more-actions menu', async () => {
    const user = userEvent.setup();
    const onToggleMainSidebar = vi.fn();
    const { rerender } = render(
      <PanelAppListItem
        deletePending={false}
        entry={baseEntry}
        favoritePending={false}
        mainSidebarPending={false}
        onDelete={vi.fn()}
        onOpen={vi.fn()}
        onToggleFavorite={vi.fn()}
        onToggleMainSidebar={onToggleMainSidebar}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Add to main sidebar' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'More panel app actions' }));
    await user.click(screen.getByRole('button', { name: 'Add to main sidebar' }));
    expect(onToggleMainSidebar).toHaveBeenCalledTimes(1);

    rerender(
      <PanelAppListItem
        deletePending={false}
        entry={{ ...baseEntry, mainSidebar: true }}
        favoritePending={false}
        mainSidebarPending={false}
        onDelete={vi.fn()}
        onOpen={vi.fn()}
        onToggleFavorite={vi.fn()}
        onToggleMainSidebar={onToggleMainSidebar}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Remove from main sidebar' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'More panel app actions' }));
    expect(screen.getByRole('button', { name: 'Remove from main sidebar' })).toBeTruthy();
  });
});
