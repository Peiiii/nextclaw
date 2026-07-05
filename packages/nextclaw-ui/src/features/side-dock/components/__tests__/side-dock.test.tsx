import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getSideDockBuiltInItems,
  SIDE_DOCK_GITHUB_PROJECT_ITEM_ID,
} from '@/features/side-dock/configs/side-dock-built-in-items.config';
import { SideDock } from '@/features/side-dock/components/side-dock';
import { useSideDockStore } from '@/features/side-dock/stores/side-dock.store';
import type { SideDockManager } from '@/features/side-dock/managers/side-dock.manager';
import { DocBrowserProvider } from '@/shared/components/doc-browser/doc-browser-context';
import { DocBrowserManager } from '@/shared/components/doc-browser/managers/doc-browser.manager';
import { useDocBrowserStore } from '@/shared/components/doc-browser/stores/doc-browser.store';
import { createDefaultDocBrowserState } from '@/shared/components/doc-browser/utils/doc-browser-state.utils';

describe('SideDock', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSideDockStore.getState().setVisible(true);
    useSideDockStore.getState().setPinnedItems([]);
    useDocBrowserStore.getState().setSnapshot(createDefaultDocBrowserState());
  });

  it('renders built-in entries and opens the selected resource', () => {
    const openItem = vi.fn();
    const manager = { openItem } as unknown as SideDockManager;
    const docBrowserManager = new DocBrowserManager();

    render(
      <DocBrowserProvider manager={docBrowserManager}>
        <SideDock manager={manager} />
      </DocBrowserProvider>,
    );

    expect(screen.getByTestId('side-dock')).toBeTruthy();
    const builtInItems = getSideDockBuiltInItems();
    builtInItems.forEach((item) => {
      expect(document.querySelector(`[data-side-dock-item-id="${item.id}"]`)).toBeTruthy();
    });

    const appsButton = document.querySelector('[data-side-dock-item-id="apps"]');
    expect(appsButton).toBeTruthy();
    fireEvent.click(appsButton as Element);

    expect(openItem).toHaveBeenCalledWith(builtInItems[0]);
  });

  it('places the GitHub project shortcut in the utility section', () => {
    const manager = { openItem: vi.fn() } as unknown as SideDockManager;
    const docBrowserManager = new DocBrowserManager();

    render(
      <DocBrowserProvider manager={docBrowserManager}>
        <SideDock manager={manager} />
      </DocBrowserProvider>,
    );

    const utilitySection = screen.getByTestId('side-dock-utility');
    expect(utilitySection.className).toContain('mt-auto');
    expect(utilitySection.querySelector(`[data-side-dock-item-id="${SIDE_DOCK_GITHUB_PROJECT_ITEM_ID}"]`)).toBeTruthy();
  });

  it('confirms before hiding the dock and persists the visibility preference', async () => {
    const manager = { openItem: vi.fn() } as unknown as SideDockManager;
    const docBrowserManager = new DocBrowserManager();

    render(
      <DocBrowserProvider manager={docBrowserManager}>
        <SideDock manager={manager} />
      </DocBrowserProvider>,
    );

    const hideButton = document.querySelector('[data-side-dock-action="hide"]');
    expect(hideButton).toBeTruthy();

    fireEvent.click(hideButton as Element);

    expect(await screen.findByText('You can turn it back on from Settings > Appearance.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));

    await waitFor(() => {
      expect(useSideDockStore.getState().isVisible).toBe(false);
    });
  });

  it('does not highlight the default docs tab while DocBrowser is closed', () => {
    const manager = { openItem: vi.fn() } as unknown as SideDockManager;
    const docBrowserManager = new DocBrowserManager();

    render(
      <DocBrowserProvider manager={docBrowserManager}>
        <SideDock manager={manager} />
      </DocBrowserProvider>,
    );

    const docsButton = document.querySelector('[data-side-dock-item-id="docs"]');

    expect(docsButton).toBeTruthy();
    expect(docsButton?.className).toContain('bg-transparent');
    expect(docsButton?.className).not.toContain('shadow-sm');
  });

  it('renders removable pinned entries and calls manager unpin by item id', () => {
    const manager = {
      openItem: vi.fn(),
      unpinItem: vi.fn(),
    } as unknown as SideDockManager;
    const docBrowserManager = new DocBrowserManager();
    useSideDockStore.getState().setPinnedItems([
      {
        createdAt: '2026-06-02T00:00:00.000Z',
        icon: { type: 'builtin', name: 'docs' },
        id: 'pinned-docs-custom',
        label: 'Custom Docs',
        target: { type: 'right-panel-resource', uri: 'nextclaw://docs/custom' },
      },
    ]);

    render(
      <DocBrowserProvider manager={docBrowserManager}>
        <SideDock manager={manager} />
      </DocBrowserProvider>,
    );

    expect(document.querySelector('[data-side-dock-item-id="pinned-docs-custom"]')).toBeTruthy();

    fireEvent.click(screen.getByTitle('Remove shortcut'));

    expect(manager.unpinItem).toHaveBeenCalledWith('pinned-docs-custom');
  });

  it('renders text icons for pinned entries', () => {
    const manager = {
      openItem: vi.fn(),
      unpinItem: vi.fn(),
    } as unknown as SideDockManager;
    const docBrowserManager = new DocBrowserManager();
    useSideDockStore.getState().setPinnedItems([
      {
        createdAt: '2026-06-02T00:00:00.000Z',
        icon: { type: 'text', value: 'D' },
        id: 'pinned-panel-app-demo',
        label: 'Demo App',
        target: { type: 'right-panel-resource', uri: 'nextclaw://panel-app/demo' },
      },
    ]);

    render(
      <DocBrowserProvider manager={docBrowserManager}>
        <SideDock manager={manager} />
      </DocBrowserProvider>,
    );

    expect(screen.getByText('D')).toBeTruthy();
  });

  it('renders emoji icons as visual dock icons instead of small text labels', () => {
    const manager = {
      openItem: vi.fn(),
      unpinItem: vi.fn(),
    } as unknown as SideDockManager;
    const docBrowserManager = new DocBrowserManager();
    useSideDockStore.getState().setPinnedItems([
      {
        createdAt: '2026-06-02T00:00:00.000Z',
        icon: { type: 'text', value: '🎨' },
        id: 'pinned-panel-app-palette',
        label: 'Palette App',
        target: { type: 'right-panel-resource', uri: 'nextclaw://panel-app/palette' },
      },
    ]);

    render(
      <DocBrowserProvider manager={docBrowserManager}>
        <SideDock manager={manager} />
      </DocBrowserProvider>,
    );

    expect(screen.getByText('🎨').className).toContain('text-[20px]');
  });
});
