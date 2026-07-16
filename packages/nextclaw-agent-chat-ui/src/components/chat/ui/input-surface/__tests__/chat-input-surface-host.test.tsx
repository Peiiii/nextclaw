import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createChatComposerTextNode } from '@agent-chat-ui/components/chat/ui/chat-input-bar/chat-composer.utils';
import { ChatInputSurfaceHost } from '@agent-chat-ui/components/chat/ui/input-surface/chat-input-surface-host';
import type {
  ChatInputSurfaceItem,
  ChatInputSurfaceTriggerChangeReason,
} from '@agent-chat-ui/components/chat/view-models/chat-ui.types';

const items = [
  {
    key: 'web-search',
    title: 'Web Search',
    subtitle: 'Skill',
    description: 'Search the web',
    detailLines: [],
    value: 'web-search',
  },
  {
    key: 'docs',
    title: 'Docs',
    subtitle: 'Skill',
    description: 'Read docs',
    detailLines: [],
    value: 'docs',
  },
];

function HostHarness({
  inputItems = items,
  marker = '/',
  onSelectItem = () => undefined,
  triggerKey = 'slash',
}: {
  inputItems?: ChatInputSurfaceItem[];
  marker?: string;
  onSelectItem?: (item: ChatInputSurfaceItem) => void;
  triggerKey?: string;
}) {
  return (
    <ChatInputSurfaceHost
      inputSurface={{
        isLoading: false,
        items: inputItems,
        texts: {
          loadingLabel: 'Loading',
          sectionLabel: 'References',
          emptyLabel: 'No result',
          hintLabel: 'Type a trigger',
          itemHintLabel: 'Enter to add',
        },
      }}
      triggerSpecs={[{ key: triggerKey, marker }]}
      onSelectItem={onSelectItem}
    >
      {(host) => {
        const publish = (text: string, reason: ChatInputSurfaceTriggerChangeReason) => {
          host.onInputSurfaceSnapshotChange(
            [createChatComposerTextNode(text)],
            { start: text.length, end: text.length },
            reason,
          );
        };

        return (
          <>
            <button type="button" onClick={() => publish(marker, { type: 'insert-text', text: marker })}>
              create
            </button>
            <button type="button" onClick={() => publish(marker, { type: 'insert-text', text: '2' })}>
              create-shifted
            </button>
            <button
              type="button"
              onClick={() => {
                publish(marker, { type: 'insert-text', text: marker });
                publish(marker, { type: 'selection' });
              }}
            >
              create-with-selection
            </button>
            <button type="button" onClick={() => publish(`${marker}你`, { type: 'insert-text', text: '你' })}>
              query
            </button>
            <button type="button" onClick={() => publish(`${marker}x `, { type: 'insert-text', text: ' ' })}>
              space
            </button>
            <button type="button" onClick={() => publish(`${marker}x`, { type: 'delete-content' })}>
              delete
            </button>
            <button
              type="button"
              onClick={() => host.onInputSurfaceKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown' }))}
            >
              down
            </button>
            <button type="button" onClick={() => host.onInputSurfaceOpenChange(false)}>
              close
            </button>
          </>
        );
      }}
    </ChatInputSurfaceHost>
  );
}

describe('ChatInputSurfaceHost', () => {
  it('creates a session only from marker insertion and does not recreate it from delete', async () => {
    render(<HostHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'create' }));
    expect(await screen.findByRole('option', { name: /Web Search/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'space' }));
    await waitFor(() => {
      expect(screen.queryByRole('option', { name: /Web Search/i })).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: 'delete' }));
    expect(screen.queryByRole('option', { name: /Web Search/i })).toBeNull();
  });

  it('recognizes a marker from the editor snapshot when the physical key label differs', async () => {
    render(<HostHarness marker="@" triggerKey="context-reference" />);

    fireEvent.click(screen.getByRole('button', { name: 'create-shifted' }));

    expect(await screen.findByRole('option', { name: /Web Search/i })).toBeTruthy();
  });

  it('keeps a newly created trigger through the editor selection notification', async () => {
    render(<HostHarness marker="@" triggerKey="context-reference" />);

    fireEvent.click(screen.getByRole('button', { name: 'create-with-selection' }));

    expect(await screen.findByRole('option', { name: /Web Search/i })).toBeTruthy();
  });

  it('keeps the active session while query text changes', async () => {
    render(<HostHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'create' }));
    expect(await screen.findByRole('option', { name: /Web Search/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'query' }));
    expect(screen.getByRole('option', { name: /Web Search/i })).toBeTruthy();
  });

  it('mounts a fresh at-trigger menu with the first item active', async () => {
    render(<HostHarness marker="@" triggerKey="panel-app-reference" />);

    fireEvent.click(screen.getByRole('button', { name: 'create' }));

    const options = await screen.findAllByRole('option');
    expect(options[0]?.getAttribute('aria-selected')).toBe('true');
    expect(options[1]?.getAttribute('aria-selected')).toBe('false');
  });

  it('keeps the active trigger open when a navigation item is selected', async () => {
    const onSelectItem = vi.fn();
    render(
      <HostHarness
        marker="@"
        triggerKey="context-reference"
        onSelectItem={onSelectItem}
        inputItems={[
          {
            ...items[0],
            key: 'files',
            title: 'Files & Folders',
            selectionBehavior: 'navigate' as const,
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'create' }));
    const option = await screen.findByRole('option', { name: /Files & Folders/i });
    fireEvent.pointerDown(option, { button: 0 });

    expect(onSelectItem).toHaveBeenCalledWith(expect.objectContaining({ key: 'files' }));
    expect(screen.getByRole('option', { name: /Files & Folders/i })).toBeTruthy();
  });

  it('resets the active item when a trigger menu is closed and recreated', async () => {
    render(<HostHarness marker="@" triggerKey="panel-app-reference" />);

    fireEvent.click(screen.getByRole('button', { name: 'create' }));
    let options = await screen.findAllByRole('option');
    expect(options[0]?.getAttribute('aria-selected')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'down' }));
    await waitFor(() => {
      options = screen.getAllByRole('option');
      expect(options[0]?.getAttribute('aria-selected')).toBe('false');
      expect(options[1]?.getAttribute('aria-selected')).toBe('true');
    });

    fireEvent.click(screen.getByRole('button', { name: 'close' }));
    await waitFor(() => {
      expect(screen.queryByRole('option', { name: /Web Search/i })).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: 'create' }));
    options = await screen.findAllByRole('option');
    expect(options[0]?.getAttribute('aria-selected')).toBe('true');
    expect(options[1]?.getAttribute('aria-selected')).toBe('false');
  });

  it('keeps the menu open while detail text starts a native selection', async () => {
    const animationFrames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      animationFrames.push(callback);
      return animationFrames.length;
    });

    try {
      render(<HostHarness />);

      fireEvent.click(screen.getByRole('button', { name: 'create' }));
      expect(await screen.findByRole('option', { name: /Web Search/i })).toBeTruthy();

      const description = screen.getByText('Search the web');
      expect(description.closest('.select-text')).toBeTruthy();
      expect(fireEvent.pointerDown(description, { pointerType: 'mouse' })).toBe(true);

      fireEvent.click(screen.getByRole('button', { name: 'close' }));
      expect(screen.getByRole('option', { name: /Web Search/i })).toBeTruthy();

      act(() => {
        animationFrames.splice(0).forEach((callback) => callback(0));
      });
      fireEvent.click(screen.getByRole('button', { name: 'close' }));
      await waitFor(() => {
        expect(screen.queryByRole('option', { name: /Web Search/i })).toBeNull();
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
