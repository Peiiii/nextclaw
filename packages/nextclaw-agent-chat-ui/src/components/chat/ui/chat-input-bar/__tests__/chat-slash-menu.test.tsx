import { createRef } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createChatPopoverAvailableHeightLimit } from '@agent-chat-ui/components/chat/ui/primitives/chat-ui-primitives';
import { ChatSlashMenu } from '@agent-chat-ui/components/chat/ui/chat-input-bar/chat-slash-menu';
import {
  ChatInputSurfaceMenu,
  type ChatInputSurfaceMenuHandle,
} from '@agent-chat-ui/components/chat/ui/input-surface/chat-input-surface-menu';
import type { ChatSlashMenuProps } from '@agent-chat-ui/components/chat/view-models/chat-ui.types';

function createSlashMenuProps(overrides?: Partial<ChatSlashMenuProps>): ChatSlashMenuProps {
  return {
    isOpen: true,
    isLoading: false,
    items: [],
    texts: {
      slashLoadingLabel: 'Loading skills',
      slashSectionLabel: 'Skills',
      slashEmptyLabel: 'No matches',
      slashHintLabel: 'Type slash',
      slashSkillHintLabel: 'Press Enter to add'
    },
    onSelectItem: vi.fn(),
    onOpenChange: vi.fn(),
    ...overrides
  };
}

describe('ChatSlashMenu', () => {
  it('renders loading and empty states', () => {
    const { rerender } = render(<ChatSlashMenu {...createSlashMenuProps({ isLoading: true })} />);
    expect(screen.getByText('Loading skills')).toBeTruthy();

    rerender(<ChatSlashMenu {...createSlashMenuProps()} />);
    expect(screen.getByText('No matches')).toBeTruthy();
  });

  it('renders active item details and forwards selection', () => {
    const onSelectItem = vi.fn();
    const item = {
      key: 'skill:web-search',
      title: 'Web Search',
      subtitle: 'Skill',
      description: 'Search the web',
      detailLines: ['Spec: workspace:/Users/tongwenwen/.nextclaw/workspace/skills/bird']
    };

    render(
      <ChatSlashMenu
        {...createSlashMenuProps({
          items: [item],
          onSelectItem
        })}
      />
    );

    expect(screen.getByText('Search the web')).toBeTruthy();
    expect(screen.getByText(/workspace:\/Users\/tongwenwen\/\.nextclaw\/workspace\/skills\/bird/i).className).toContain('break-all');
    fireEvent.pointerDown(screen.getByRole('option', { name: /Web Search/i }));
    expect(onSelectItem).toHaveBeenCalledWith(item);
  });

  it('filters slash items by category tags with visible counts', () => {
    const commandItem = {
      key: 'command:side-chat',
      title: 'Side chat',
      subtitle: 'Command',
      description: 'Open a side chat',
      detailLines: [],
      sectionKey: 'commands',
      sectionLabel: 'Commands',
    };
    const skillItem = {
      key: 'skill:web-search',
      title: 'Web Search',
      subtitle: 'Skill',
      description: 'Search the web',
      detailLines: [],
      sectionKey: 'skills',
      sectionLabel: 'Skills',
    };
    const panelAppItem = {
      key: 'panel-app-action:task-board',
      title: 'Task Board',
      subtitle: 'Panel App',
      description: 'Open task board',
      detailLines: [],
      sectionKey: 'panel-apps',
      sectionLabel: 'Panel Apps',
    };

    render(
      <ChatSlashMenu
        {...createSlashMenuProps({
          filterOptions: [
            { key: 'all', label: 'All' },
            { key: 'commands', label: 'Commands', sectionKeys: ['commands'] },
            { key: 'skills', label: 'Skills', sectionKeys: ['skills'] },
            { key: 'panel-apps', label: 'Panel Apps', sectionKeys: ['panel-apps'] },
          ],
          items: [commandItem, skillItem, panelAppItem],
        })}
      />
    );

    expect(screen.getByRole('button', { name: 'All 3' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Panel Apps 1' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Panel Apps 1' }));

    expect(screen.queryByRole('option', { name: /Side chat/i })).toBeNull();
    expect(screen.queryByRole('option', { name: /Web Search/i })).toBeNull();
    expect(screen.getByRole('option', { name: /Task Board/i }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Open task board')).toBeTruthy();
  });

  it('selects items before composer blur can close the menu', () => {
    const onSelectItem = vi.fn();
    const item = {
      key: 'skill:web-search',
      title: 'Web Search',
      subtitle: 'Skill',
      description: 'Search the web',
      detailLines: []
    };

    render(
      <ChatSlashMenu
        {...createSlashMenuProps({
          items: [item],
          onSelectItem
        })}
      />
    );

    fireEvent.pointerDown(screen.getByRole('option', { name: /Web Search/i }), {
      pointerType: 'mouse'
    });

    expect(onSelectItem).toHaveBeenCalledTimes(1);
    expect(onSelectItem).toHaveBeenCalledWith(item);
  });

  it('constrains the slash menu to the available viewport height', () => {
    render(<ChatSlashMenu {...createSlashMenuProps()} />);

    const listbox = screen.getByRole('listbox', { name: 'Skills' });
    const anchor = document.querySelector('.pointer-events-none.absolute') as HTMLElement | null;
    expect(anchor?.className).toContain('top-0');
    expect(anchor?.className).toContain('bottom-0');
    expect(listbox.className).toContain('overflow-y-auto');
    expect(listbox.closest('[data-state="open"]')?.getAttribute('style')).toContain(
      createChatPopoverAvailableHeightLimit('24rem'),
    );
    expect(listbox.closest('[data-state="open"]')?.getAttribute('style')).toContain('max(0px');
    expect(listbox.closest('[data-state="open"]')?.getAttribute('style')).toContain('100vh');
    expect(listbox.closest('[data-state="open"]')?.getAttribute('style')).toContain('2rem');
    expect(listbox.className).toContain('overscroll-contain');
  });

  it('owns keyboard focus state inside the menu instance', () => {
    const ref = createRef<ChatInputSurfaceMenuHandle>();
    const onSelectItem = vi.fn();
    const onOpenChange = vi.fn();
    const firstItem = {
      key: 'web-search',
      title: 'Web Search',
      subtitle: 'Skill',
      description: 'Search the web',
      detailLines: []
    };
    const secondItem = {
      ...firstItem,
      key: 'docs',
      title: 'Docs'
    };

    render(
      <ChatInputSurfaceMenu
        ref={ref}
        isOpen
        isLoading={false}
        items={[firstItem, secondItem]}
        texts={{
          loadingLabel: 'Loading',
          sectionLabel: 'References',
          emptyLabel: 'No matches',
          hintLabel: 'Type a trigger',
          itemHintLabel: 'Press Enter to add'
        }}
        onOpenChange={onOpenChange}
        onSelectItem={onSelectItem}
      />
    );

    expect(screen.getByRole('option', { name: /Web Search/i }).getAttribute('aria-selected')).toBe('true');

    act(() => {
      ref.current?.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    });
    expect(screen.getByRole('option', { name: /Docs/i }).getAttribute('aria-selected')).toBe('true');

    act(() => {
      ref.current?.handleKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));
    });
    expect(onSelectItem).toHaveBeenCalledWith(secondItem);

    act(() => {
      ref.current?.handleKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not move active item when the menu opens under a stationary pointer', () => {
    const firstItem = {
      key: 'web-search',
      title: 'Web Search',
      subtitle: 'Skill',
      description: 'Search the web',
      detailLines: []
    };
    const secondItem = {
      ...firstItem,
      key: 'docs',
      title: 'Docs'
    };

    render(
      <ChatInputSurfaceMenu
        isOpen
        isLoading={false}
        items={[firstItem, secondItem]}
        texts={{
          loadingLabel: 'Loading',
          sectionLabel: 'References',
          emptyLabel: 'No matches',
          hintLabel: 'Type a trigger',
          itemHintLabel: 'Press Enter to add'
        }}
        onOpenChange={vi.fn()}
        onSelectItem={vi.fn()}
      />
    );

    const firstOption = screen.getByRole('option', { name: /Web Search/i });
    const secondOption = screen.getByRole('option', { name: /Docs/i });
    expect(firstOption.getAttribute('aria-selected')).toBe('true');

    fireEvent.mouseEnter(secondOption);
    expect(firstOption.getAttribute('aria-selected')).toBe('true');

    fireEvent.pointerMove(secondOption, { pointerType: 'mouse' });
    expect(secondOption.getAttribute('aria-selected')).toBe('true');
  });
});
