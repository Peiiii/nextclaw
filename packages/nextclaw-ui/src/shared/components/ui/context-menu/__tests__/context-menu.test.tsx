import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ContextMenu, ContextMenuTrigger } from '@/shared/components/ui/context-menu/context-menu';

describe('ContextMenu', () => {
  it('keeps modal actions inside the dialog focus boundary and consumes Escape', async () => {
    const onSelect = vi.fn();
    const onDialogKeyDown = vi.fn();
    render(
      <div role="dialog" onKeyDown={onDialogKeyDown}>
        <ContextMenu label="Resource actions" groups={[{ key: 'open', items: [{ key: 'open', label: 'Open resource', onSelect }] }]}>
          <div><ContextMenuTrigger><button type="button">Actions</button></ContextMenuTrigger></div>
        </ContextMenu>
      </div>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Actions' }));
    const menu = screen.getByRole('menu');
    expect(menu.closest('[role="dialog"]')).toBe(screen.getByRole('dialog'));
    expect(menu.parentElement?.className).toContain('pointer-events-auto');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(onDialogKeyDown).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Actions' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Open resource' }));
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('opens at the trigger and supports keyboard selection', async () => {
    const onSelect = vi.fn();
    render(
      <ContextMenu
        label="File actions"
        groups={[
          {
            key: 'file',
            items: [
              { key: 'open', label: 'Open', onSelect: vi.fn() },
              { key: 'copy', label: 'Copy path', onSelect },
            ],
          },
        ]}
      >
        <button type="button">README.md</button>
      </ContextMenu>,
    );

    fireEvent.contextMenu(screen.getByRole('button', { name: 'README.md' }), {
      clientX: 120,
      clientY: 80,
    });

    expect(screen.getByRole('menu', { name: 'File actions' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Open' }));
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens the same menu from an explicit trigger', async () => {
    const onSelect = vi.fn();
    render(
      <ContextMenu
        label="File actions"
        groups={[
          {
            key: 'file',
            items: [{ key: 'add', label: 'Add to chat', onSelect }],
          },
        ]}
      >
        <div>
          <span>README.md</span>
          <ContextMenuTrigger>
            <button type="button" aria-label="More actions" />
          </ContextMenuTrigger>
        </div>
      </ContextMenu>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.getByRole('menu', { name: 'File actions' })).toBeTruthy();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Add to chat' }));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('keeps download actions as keyboard-focusable links', async () => {
    render(
      <ContextMenu
        label="File actions"
        groups={[
          {
            key: 'file',
            items: [
              {
                key: 'download',
                label: 'Download',
                href: '/api/files/report.md',
                download: 'report.md',
              },
            ],
          },
        ]}
      >
        <button type="button">report.md</button>
      </ContextMenu>,
    );

    fireEvent.contextMenu(screen.getByRole('button', { name: 'report.md' }));
    const download = screen.getByRole('menuitem', { name: 'Download' });
    expect(document.activeElement).toBe(download);
    expect(download.tagName).toBe('A');
    expect(download.getAttribute('download')).toBe('report.md');
  });

  it('does not steal focus back when an action focuses the composer', async () => {
    render(
      <div>
        <button type="button" data-testid="composer">
          Composer
        </button>
        <ContextMenu
          label="File actions"
          groups={[
            {
              key: 'chat',
              items: [
                {
                  key: 'add',
                  label: 'Add to chat',
                  restoreFocus: false,
                  onSelect: () => screen.getByTestId('composer').focus(),
                },
              ],
            },
          ]}
        >
          <button type="button">README.md</button>
        </ContextMenu>
      </div>,
    );

    fireEvent.contextMenu(screen.getByRole('button', { name: 'README.md' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Add to chat' }));

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByTestId('composer'));
    });
  });
});
