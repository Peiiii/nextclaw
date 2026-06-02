import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SIDE_DOCK_BUILT_IN_ITEMS } from '@/features/side-dock/configs/side-dock-built-in-items.config';
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
    SIDE_DOCK_BUILT_IN_ITEMS.forEach((item) => {
      expect(document.querySelector(`[data-side-dock-item-id="${item.id}"]`)).toBeTruthy();
    });

    const appsButton = document.querySelector('[data-side-dock-item-id="apps"]');
    expect(appsButton).toBeTruthy();
    fireEvent.click(appsButton as Element);

    expect(openItem).toHaveBeenCalledWith(SIDE_DOCK_BUILT_IN_ITEMS[0]);
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
});
