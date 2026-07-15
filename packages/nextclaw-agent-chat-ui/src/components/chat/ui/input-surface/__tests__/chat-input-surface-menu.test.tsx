import { render } from '@testing-library/react';
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
