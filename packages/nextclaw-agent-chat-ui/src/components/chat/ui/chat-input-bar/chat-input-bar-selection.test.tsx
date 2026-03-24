import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChatInputBar } from './chat-input-bar';
import type { ChatComposerNode, ChatInputBarProps } from '../../view-models/chat-ui.types';
import { createChatComposerTextNode } from './chat-composer.utils';

function createInputBarProps(overrides?: Partial<ChatInputBarProps>): ChatInputBarProps {
  return {
    composer: {
      nodes: [createChatComposerTextNode('Hello')],
      placeholder: 'Type a message',
      disabled: false,
      onNodesChange: vi.fn()
    },
    slashMenu: {
      isLoading: false,
      items: [],
      texts: {
        slashLoadingLabel: 'Loading',
        slashSectionLabel: 'Skills',
        slashEmptyLabel: 'No result',
        slashHintLabel: 'Type /',
        slashSkillHintLabel: 'Enter to add'
      }
    },
    hint: null,
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

function setSelectionAcrossElement(element: HTMLElement) {
  const firstNode = element.firstChild;
  const lastNode = element.lastChild;
  if (!firstNode || !lastNode) {
    return;
  }
  const selection = window.getSelection();
  const range = document.createRange();
  range.setStart(firstNode, 0);
  if (lastNode.nodeType === Node.TEXT_NODE) {
    range.setEnd(lastNode, lastNode.textContent?.length ?? 0);
  } else {
    range.setEndAfter(lastNode);
  }
  selection?.removeAllRanges();
  selection?.addRange(range);
}

describe('ChatInputBar selection behavior', () => {
  it('deletes the whole selected draft instead of only the last character', () => {
    function Harness() {
      const [nodes, setNodes] = useState<ChatComposerNode[]>([createChatComposerTextNode('hello world')]);

      return (
        <ChatInputBar
          {...createInputBarProps({
            composer: {
              nodes,
              placeholder: 'Type a message',
              disabled: false,
              onNodesChange: setNodes
            }
          })}
        />
      );
    }

    render(<Harness />);

    const textbox = screen.getByRole('textbox');
    fireEvent.focus(textbox);
    setSelectionAcrossElement(textbox);

    fireEvent.keyDown(textbox, { key: 'Backspace' });

    expect(textbox.textContent).toBe('');
  });
});
