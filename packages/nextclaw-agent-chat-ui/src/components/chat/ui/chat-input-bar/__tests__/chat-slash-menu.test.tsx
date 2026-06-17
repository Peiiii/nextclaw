import { fireEvent, render, screen } from '@testing-library/react';
import { createChatPopoverAvailableHeightLimit } from '@agent-chat-ui/components/chat/ui/primitives/chat-ui-primitives';
import { ChatSlashMenu } from '@agent-chat-ui/components/chat/ui/chat-input-bar/chat-slash-menu';
import type { ChatSlashMenuProps } from '@agent-chat-ui/components/chat/view-models/chat-ui.types';

function createSlashMenuProps(overrides?: Partial<ChatSlashMenuProps>): ChatSlashMenuProps {
  return {
    isOpen: true,
    isLoading: false,
    items: [],
    activeIndex: 0,
    activeItem: null,
    texts: {
      slashLoadingLabel: 'Loading skills',
      slashSectionLabel: 'Skills',
      slashEmptyLabel: 'No matches',
      slashHintLabel: 'Type slash',
      slashSkillHintLabel: 'Press Enter to add'
    },
    onSelectItem: vi.fn(),
    onOpenChange: vi.fn(),
    onSetActiveIndex: vi.fn(),
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
          activeItem: item,
          onSelectItem
        })}
      />
    );

    expect(screen.getByText('Search the web')).toBeTruthy();
    expect(screen.getByText(/workspace:\/Users\/tongwenwen\/\.nextclaw\/workspace\/skills\/bird/i).className).toContain('break-all');
    fireEvent.click(screen.getByRole('option', { name: /Web Search/i }));
    expect(onSelectItem).toHaveBeenCalledWith(item);
  });

  it('constrains the slash menu to the available viewport height', () => {
    render(<ChatSlashMenu {...createSlashMenuProps()} />);

    const listbox = screen.getByRole('listbox', { name: 'Skills' });
    expect(listbox.className).toContain('overflow-y-auto');
    expect(listbox.closest('[data-state="open"]')?.getAttribute('style')).toContain(
      createChatPopoverAvailableHeightLimit('24rem'),
    );
    expect(listbox.closest('[data-state="open"]')?.getAttribute('style')).toContain('max(0px');
    expect(listbox.closest('[data-state="open"]')?.getAttribute('style')).toContain('100vh');
    expect(listbox.closest('[data-state="open"]')?.getAttribute('style')).toContain('2rem');
    expect(listbox.className).toContain('overscroll-contain');
  });
});
