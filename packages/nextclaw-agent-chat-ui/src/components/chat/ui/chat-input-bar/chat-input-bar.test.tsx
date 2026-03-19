import { fireEvent, render, screen } from '@testing-library/react';
import { ChatInputBar } from './chat-input-bar';
import type { ChatInputBarProps } from '../../view-models/chat-ui.types';

function createInputBarProps(overrides?: Partial<ChatInputBarProps>): ChatInputBarProps {
  return {
    value: 'Hello',
    placeholder: 'Type a message',
    disabled: false,
    onValueChange: vi.fn(),
    onKeyDown: vi.fn(),
    slashMenu: {
      isOpen: false,
      isLoading: false,
      items: [],
      activeIndex: 0,
      activeItem: null,
      texts: {
        slashLoadingLabel: 'Loading',
        slashSectionLabel: 'Skills',
        slashEmptyLabel: 'No result',
        slashHintLabel: 'Hint',
        slashSkillHintLabel: 'Enter to add'
      },
      onSelectItem: vi.fn(),
      onOpenChange: vi.fn(),
      onSetActiveIndex: vi.fn()
    },
    hint: null,
    selectedItems: {
      items: [],
      onRemove: vi.fn()
    },
    toolbar: {
      selects: [],
      actions: {
        isSending: false,
        canStopGeneration: false,
        sendDisabled: false,
        stopDisabled: true,
        stopHint: 'Stop unavailable',
        sendButtonLabel: 'Send',
        stopButtonLabel: 'Stop',
        onSend: vi.fn(),
        onStop: vi.fn()
      }
    },
    ...overrides
  };
}

describe('ChatInputBar', () => {
  it('renders placeholder, selected chips, and calls chip removal', () => {
    const onRemove = vi.fn();

    render(
      <ChatInputBar
        {...createInputBarProps({
          value: '',
          selectedItems: {
            items: [{ key: 'skill:web-search', label: 'Web Search' }],
            onRemove
          }
        })}
      />
    );

    const textarea = screen.getByPlaceholderText('Type a message');
    const chipButton = screen.getByRole('button', { name: /Web Search/i });

    expect(textarea).toBeTruthy();
    expect(chipButton).toBeTruthy();
    expect(chipButton.parentElement?.contains(textarea)).toBe(true);

    fireEvent.click(chipButton);
    expect(onRemove).toHaveBeenCalledWith('skill:web-search');
  });

  it('removes the last selected chip when backspace is pressed on an empty draft', () => {
    const onRemove = vi.fn();
    const onKeyDown = vi.fn();

    render(
      <ChatInputBar
        {...createInputBarProps({
          value: '',
          onKeyDown,
          selectedItems: {
            items: [
              { key: 'skill:web-search', label: 'Web Search' },
              { key: 'skill:docs', label: 'Docs' }
            ],
            onRemove
          }
        })}
      />
    );

    fireEvent.keyDown(screen.getByPlaceholderText('Type a message'), { key: 'Backspace' });

    expect(onRemove).toHaveBeenCalledWith('skill:docs');
    expect(onKeyDown).not.toHaveBeenCalled();
  });

  it('switches between send and stop controls', () => {
    const onSend = vi.fn();
    const onStop = vi.fn();
    const { rerender } = render(
      <ChatInputBar
        {...createInputBarProps({
          toolbar: {
            selects: [],
            actions: {
              isSending: false,
              canStopGeneration: false,
              sendDisabled: false,
              stopDisabled: true,
              stopHint: 'Stop unavailable',
              sendButtonLabel: 'Send',
              stopButtonLabel: 'Stop',
              onSend,
              onStop
            }
          }
        })}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSend).toHaveBeenCalled();
    expect(screen.queryByTestId('chat-stop-icon')).toBeNull();

    rerender(
      <ChatInputBar
        {...createInputBarProps({
          toolbar: {
            selects: [],
            actions: {
              isSending: true,
              canStopGeneration: true,
              sendDisabled: true,
              stopDisabled: false,
              stopHint: 'Stop unavailable',
              sendButtonLabel: 'Send',
              stopButtonLabel: 'Stop',
              onSend,
              onStop
            }
          }
        })}
      />
    );

    expect(screen.getByTestId('chat-stop-icon').className).toContain('bg-gray-700');
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(onStop).toHaveBeenCalled();
  });
});
