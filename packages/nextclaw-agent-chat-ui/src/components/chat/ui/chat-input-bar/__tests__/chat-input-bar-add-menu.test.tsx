import { fireEvent, render, screen } from '@testing-library/react';
import { ChatInputBarAddMenu } from '@agent-chat-ui/components/chat/ui/chat-input-bar/chat-input-bar-add-menu';
import type { ChatSkillPickerProps } from '@agent-chat-ui/components/chat/view-models/chat-ui.types';

const createPicker = (): ChatSkillPickerProps => ({
  title: 'Skills',
  searchPlaceholder: 'Search skills',
  loadingLabel: 'Loading skills',
  emptyLabel: 'No skills',
  options: [
    { key: 'web-search', label: 'Web Search', description: 'Search the web' },
    { key: '$builtin/summarize', label: 'Summarize', description: 'Summarize the conversation' },
  ],
  groups: [
    {
      key: 'workspace',
      label: 'Workspace skills',
      options: [{ key: 'web-search', label: 'Web Search', description: 'Search the web' }],
    },
    {
      key: 'builtin',
      label: 'Built-in skills',
      options: [{
        key: '$builtin/summarize',
        label: 'Summarize',
        description: 'Summarize the conversation',
      }],
    },
  ],
  selectedKeys: [],
  onSelectedKeysChange: vi.fn(),
});

it('opens a compact action menu before the height-capped skill view', () => {
  render(<ChatInputBarAddMenu label="Add content" accessories={[]} picker={createPicker()} />);

  fireEvent.click(screen.getByRole('button', { name: 'Add content' }));
  expect(screen.queryByRole('listbox')).toBeNull();
  expect(screen.queryByPlaceholderText('Search skills')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Skills' }));
  const listbox = screen.getByRole('listbox');
  const panelStyle = listbox.closest('[data-state="open"]')?.getAttribute('style') ?? '';
  expect(listbox.className).toContain('flex-1');
  expect(listbox.className).toContain('overflow-y-auto');
  expect(listbox.className).toContain('overscroll-contain');
  expect(panelStyle).toContain('20rem');
  expect(panelStyle).toContain('--radix-popover-content-available-height');
  expect(panelStyle).toContain('100vh');
  expect(panelStyle).toContain('2rem');

  fireEvent.change(screen.getByPlaceholderText('Search skills'), { target: { value: 'summ' } });
  expect(screen.getByText('Summarize')).toBeTruthy();
  expect(screen.queryByText('Web Search')).toBeNull();
  expect(screen.queryByRole('button', { name: /built-in skills/i })).toBeNull();
});
