import { fireEvent, render, screen } from '@testing-library/react';
import { ChatSlashMenu } from './chat-slash-menu';
import type { ChatSlashMenuProps } from '../../view-models/chat-ui.types';

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
});
