import { fireEvent, render, screen } from '@testing-library/react';
import { ChatInputBarToolbar } from './chat-input-bar-toolbar';

function createActions() {
  return {
    isSending: false,
    canStopGeneration: false,
    sendDisabled: false,
    stopDisabled: true,
    stopHint: 'Stop unavailable',
    sendButtonLabel: 'Send',
    stopButtonLabel: 'Stop',
    onSend: vi.fn(),
    onStop: vi.fn(),
  };
}

it('searches toolbar model options and toggles option favorites', async () => {
  const onFavoriteToggle = vi.fn();
  render(
    <ChatInputBarToolbar
      selects={[
        {
          key: 'model',
          value: 'openai/gpt-5',
          placeholder: 'Select model',
          selectedLabel: 'OpenAI/gpt-5',
          search: {
            placeholder: 'Search models',
            emptyLabel: 'No models found',
          },
          optionAction: {
            kind: 'favorite',
            activeValues: [],
            activeLabel: 'Remove favorite',
            inactiveLabel: 'Add favorite',
            onToggle: onFavoriteToggle,
          },
          options: [
            {
              value: 'openai/gpt-5',
              label: 'OpenAI/gpt-5',
            },
            {
              value: 'anthropic/claude-sonnet-4',
              label: 'Anthropic/claude-sonnet-4',
            },
            {
              value: 'minimax/minimax-m2.7',
              label: 'MiniMax/minimax-m2.7',
            },
          ],
          onValueChange: vi.fn(),
        },
      ]}
      actions={createActions()}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: 'Select model: OpenAI/gpt-5' }));
  fireEvent.change(screen.getByPlaceholderText('Search models'), {
    target: { value: 'claude' },
  });

  expect(await screen.findByText('Anthropic/claude-sonnet-4')).toBeTruthy();
  expect(screen.queryByText('MiniMax/minimax-m2.7')).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Add favorite' }));
  expect(onFavoriteToggle).toHaveBeenCalledWith('anthropic/claude-sonnet-4', true);
});

it('keeps searchable toolbar menus constrained to the available viewport height', async () => {
  render(
    <ChatInputBarToolbar
      selects={[
        {
          key: 'model',
          value: 'openai/gpt-5',
          placeholder: 'Select model',
          selectedLabel: 'OpenAI/gpt-5',
          search: {
            placeholder: 'Search models',
            emptyLabel: 'No models found',
          },
          options: [
            {
              value: 'openai/gpt-5',
              label: 'OpenAI/gpt-5',
            },
          ],
          onValueChange: vi.fn(),
        },
      ]}
      actions={createActions()}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: 'Select model: OpenAI/gpt-5' }));

  const option = await screen.findByRole('button', { name: 'OpenAI/gpt-5' });
  expect(option.closest('[data-state="open"]')?.getAttribute('style')).toContain(
    'min(22rem, calc(var(--radix-popover-content-available-height) - 0.75rem))',
  );
});
