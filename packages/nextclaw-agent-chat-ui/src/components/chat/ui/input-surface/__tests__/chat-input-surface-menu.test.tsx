import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChatInputSurfaceMenu } from '@agent-chat-ui/components/chat/ui/input-surface/chat-input-surface-menu';

it('renders the semantic icon assigned to each input-surface item', () => {
  render(
    <ChatInputSurfaceMenu
      isOpen
      isLoading={false}
      items={[
        { key: 'command', icon: 'command', title: 'Command', subtitle: '', description: '', detailLines: [] },
        { key: 'panel-app', icon: 'panel-app', title: 'Panel app', subtitle: '', description: '', detailLines: [] },
        { key: 'skill', icon: 'skill', title: 'Skill', subtitle: '', description: '', detailLines: [] },
      ]}
      texts={{
        loadingLabel: 'Loading',
        sectionLabel: 'Items',
        emptyLabel: 'No items',
        hintLabel: 'Type',
        itemHintLabel: 'Select',
      }}
      onOpenChange={vi.fn()}
      onSelectItem={vi.fn()}
    />,
  );

  expect(document.querySelectorAll('[data-input-surface-icon="command"]')).toHaveLength(1);
  expect(document.querySelectorAll('[data-input-surface-icon="panel-app"]')).toHaveLength(1);
  expect(document.querySelectorAll('[data-input-surface-icon="skill"]')).toHaveLength(1);
});

it('starts a revisited navigation view from its first item', () => {
  function NavigationHarness() {
    const [view, setView] = useState<'root' | 'files'>('root');
    const items = view === 'root'
      ? [
          {
            key: 'files',
            title: 'Files & Folders',
            subtitle: '',
            description: '',
            detailLines: [],
            selectionBehavior: 'navigate' as const,
          },
        ]
      : [
          {
            key: 'back',
            title: 'Back',
            subtitle: '',
            description: '',
            detailLines: [],
            selectionBehavior: 'navigate' as const,
          },
          { key: 'src', title: 'src', subtitle: '', description: '', detailLines: [] },
          { key: 'docs', title: 'docs', subtitle: '', description: '', detailLines: [] },
        ];
    return (
      <ChatInputSurfaceMenu
        isOpen
        isLoading={false}
        items={items}
        texts={{
          loadingLabel: 'Loading',
          sectionLabel: 'Items',
          emptyLabel: 'No items',
          hintLabel: 'Type',
          itemHintLabel: 'Select',
        }}
        onOpenChange={vi.fn()}
        onSelectItem={(item) => setView(item.key === 'back' ? 'root' : 'files')}
      />
    );
  }

  render(<NavigationHarness />);
  fireEvent.pointerDown(screen.getByRole('option', { name: 'Files & Folders' }), { button: 0 });
  fireEvent.pointerMove(screen.getByRole('option', { name: 'docs' }), { pointerType: 'mouse' });
  fireEvent.pointerDown(screen.getByRole('option', { name: 'Back' }), { button: 0 });
  fireEvent.pointerDown(screen.getByRole('option', { name: 'Files & Folders' }), { button: 0 });

  expect(screen.getByRole('option', { name: 'Back' }).getAttribute('aria-selected')).toBe('true');
  expect(screen.getByRole('option', { name: 'docs' }).getAttribute('aria-selected')).toBe('false');
});
