import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, expect, it, vi } from 'vitest';
import {
  createChatPopoverAvailableHeightLimit,
  createChatSelectAvailableHeightLimit,
} from '@agent-chat-ui/components/chat/ui/primitives/chat-ui-primitives';
import type { ChatToolbarSelect } from '@agent-chat-ui/components/chat/view-models/chat-ui.types';
import { ChatInputBarToolbar } from '@agent-chat-ui/components/chat/ui/chat-input-bar/chat-input-bar-toolbar';

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

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

function createModelSelect(overrides: Partial<ChatToolbarSelect> = {}): ChatToolbarSelect {
  return {
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
    ...overrides,
  };
}

function createThinkingSelect(overrides: Partial<ChatToolbarSelect> = {}): ChatToolbarSelect {
  return {
    key: 'thinking',
    value: 'high',
    placeholder: 'Thinking',
    selectedLabel: 'High',
    options: Array.from({ length: 24 }, (_, index) => ({
      value: `level-${index}`,
      label: `Level ${index}`,
    })),
    onValueChange: vi.fn(),
    ...overrides,
  };
}

it('searches toolbar model options and toggles option favorites', async () => {
  const onFavoriteToggle = vi.fn();
  render(
    <ChatInputBarToolbar
      selects={[
        createModelSelect({
          optionAction: {
            kind: 'favorite',
            activeValues: [],
            activeLabel: 'Remove favorite',
            inactiveLabel: 'Add favorite',
            onToggle: onFavoriteToggle,
          },
        }),
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

  const favoriteButton = screen.getByRole('button', { name: 'Add favorite' });
  expect(favoriteButton.getAttribute('aria-pressed')).toBe('false');

  fireEvent.click(favoriteButton);
  expect(onFavoriteToggle).toHaveBeenCalledWith('anthropic/claude-sonnet-4', true);
});

it('marks active toolbar option actions as pressed', async () => {
  render(
    <ChatInputBarToolbar
      selects={[
        createModelSelect({
          optionAction: {
            kind: 'favorite',
            activeValues: ['openai/gpt-5'],
            activeLabel: 'Remove favorite',
            inactiveLabel: 'Add favorite',
            onToggle: vi.fn(),
          },
          options: [
            {
              value: 'openai/gpt-5',
              label: 'OpenAI/gpt-5',
            },
          ],
        }),
      ]}
      actions={createActions()}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: 'Select model: OpenAI/gpt-5' }));

  const favoriteButton = await screen.findByRole('button', { name: 'Remove favorite' });
  expect(favoriteButton.getAttribute('aria-pressed')).toBe('true');
});

it('keeps searchable toolbar menus constrained to the available viewport height', async () => {
  render(
    <ChatInputBarToolbar
      selects={[createModelSelect()]}
      actions={createActions()}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: 'Select model: OpenAI/gpt-5' }));

  const option = await screen.findByRole('button', { name: 'OpenAI/gpt-5' });
  expect(option.closest('[data-state="open"]')?.getAttribute('style')).toContain(
    createChatPopoverAvailableHeightLimit('18rem'),
  );
  expect(option.closest('[data-state="open"]')?.getAttribute('style')).toContain('max(0px');
  expect(option.closest('[data-state="open"]')?.getAttribute('style')).toContain('100vh');
  expect(option.closest('[data-state="open"]')?.getAttribute('style')).toContain('2rem');
  expect(option.closest('.overflow-y-auto')?.className).toContain('overscroll-contain');
});

it('keeps non-search toolbar select menus constrained with an internal scroll region', async () => {
  render(
    <ChatInputBarToolbar
      selects={[createThinkingSelect()]}
      actions={createActions()}
    />
  );

  fireEvent.click(screen.getByRole('combobox', { name: 'Thinking: High' }));

  const option = await screen.findByRole('option', { name: 'Level 0' });
  const panel = option.closest('[data-state="open"]');
  const scrollRegion = option.closest('.overflow-y-auto');

  expect(panel?.getAttribute('style')).toContain(
    createChatSelectAvailableHeightLimit('18rem'),
  );
  expect(panel?.getAttribute('style')).toContain('max(0px');
  expect(panel?.getAttribute('style')).toContain('100vh');
  expect(panel?.getAttribute('style')).toContain('2rem');
  expect(panel?.className).toContain('flex-col');
  expect(scrollRegion?.className).toContain('flex-1');
  expect(scrollRegion?.className).toContain('overscroll-contain');
});

it('keeps compact configuration selects before the context and send actions', () => {
  render(
    <ChatInputBarToolbar
      selects={[]}
      trailingSelects={[createModelSelect(), createThinkingSelect()]}
      actions={{
        ...createActions(),
        contextWindow: {
          label: 'Context window',
          percentLabel: '38%',
          ratio: 0.38,
          tone: 'neutral',
          details: [],
        },
      }}
    />,
  );

  const model = screen.getByRole('button', { name: 'Select model: OpenAI/gpt-5' });
  const thinking = screen.getByRole('combobox', { name: 'Thinking: High' });
  const contextWindow = screen.getByRole('button', { name: 'Context window' });
  const send = screen.getByRole('button', { name: 'Send' });

  expect(model.className).not.toContain('flex-1');
  expect(model.className).toContain('max-w-[18rem]');
  expect(model.compareDocumentPosition(thinking) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(thinking.compareDocumentPosition(contextWindow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(contextWindow.compareDocumentPosition(send) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
