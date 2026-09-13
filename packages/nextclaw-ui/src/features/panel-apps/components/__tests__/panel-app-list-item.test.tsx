import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { viewportLayoutManager } from '@/app/managers/viewport-layout.manager';
import { useViewportLayoutStore } from '@/app/stores/viewport-layout.store';
import { PanelAppListItem } from '@/features/panel-apps/components/panel-app-list-item';

const mainSidebarMutation = vi.hoisted(() => ({
  isPending: false,
  pinned: false,
  mutate: vi.fn(),
}));

vi.mock('@/features/panel-apps/hooks/use-panel-apps', () => ({
  usePanelApps: () => ({ data:{ entries:[{ ...baseEntry, mainSidebar: mainSidebarMutation.pinned }] } }),
  useUpdatePanelAppPreferences: () => mainSidebarMutation,
}));

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
  beforeEach(() => {
    window.localStorage.clear();
    viewportLayoutManager.resetForTests();
    mainSidebarMutation.isPending = false;
    mainSidebarMutation.pinned = false;
    mainSidebarMutation.mutate.mockReset();
  });

  it('keeps panel app metadata compact below the icon-title row', () => {
    const { container } = render(
      <PanelAppListItem
        deletePending={false}
        entry={baseEntry}
        favoritePending={false}
        onDelete={vi.fn()}
        onOpen={vi.fn()}
        onToggleFavorite={vi.fn()}
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
        onDelete={onDelete}
        onOpen={vi.fn()}
        onToggleFavorite={vi.fn()}
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
    viewportLayoutManager.setMainSidebarAppGroupCollapsed(true);
    const { rerender } = render(
      <PanelAppListItem
        deletePending={false}
        entry={baseEntry}
        favoritePending={false}
        onDelete={vi.fn()}
        onOpen={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );

    expect(screen.queryByRole('menuitem', { name: 'Pin to left sidebar' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'More panel app actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Layout and position' }));
    await user.click(screen.getByRole('menuitem', { name: 'Pin to left sidebar' }));
    expect(mainSidebarMutation.mutate).toHaveBeenCalledWith({
      id: 'demo',
      preferences: { mainSidebar: true },
    });
    expect(
      useViewportLayoutStore.getState().isMainSidebarAppGroupCollapsed,
    ).toBe(false);

    mainSidebarMutation.pinned = true;
    rerender(
      <PanelAppListItem
        deletePending={false}
        entry={{ ...baseEntry, mainSidebar: true }}
        favoritePending={false}
        onDelete={vi.fn()}
        onOpen={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );
    expect(screen.queryByRole('menuitem', { name: 'Unpin from left sidebar' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'More panel app actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Layout and position' }));
    await user.click(screen.getByRole('menuitem', { name: 'Unpin from left sidebar' }));
    expect(mainSidebarMutation.mutate).toHaveBeenLastCalledWith({
      id: 'demo',
      preferences: { mainSidebar: false },
    });
  });

  it('offers the standalone app link from the more-actions menu', async () => {
    const user = userEvent.setup();
    render(
      <PanelAppListItem
        deletePending={false}
        entry={baseEntry}
        favoritePending={false}
        onDelete={vi.fn()}
        onOpen={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'More panel app actions' }));
    const link = screen.getByRole('link', { name: 'Open in New Tab' });
    expect(link.getAttribute('href')).toBe('/apps/panel/demo/standalone');
  });
});

vi.mock("react-router-dom", async (importOriginal) => ({ ...(await importOriginal<object>()),useNavigate: () => vi.fn(), useLocation: () => ({ pathname:'/apps',search:'' }) }));
vi.mock("@/app/components/app-presenter-provider", () => ({ useAppPresenter: () => ({ pageResourceManager:{ open:vi.fn() } }) }));
