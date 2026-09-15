import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ChatInputBar } from '@agent-chat-ui/components/chat/ui/chat-input-bar/chat-input-bar';
import { createChatComposerTextNode } from '@agent-chat-ui/components/chat/ui/chat-input-bar/chat-composer.utils';
import type { ChatInputBarProps } from '@agent-chat-ui/components/chat/view-models/chat-ui.types';

function createInputBar(nodes: ChatInputBarProps['composer']['nodes'], onNodesChange: ChatInputBarProps['composer']['onNodesChange']) {
  return (
    <ChatInputBar
      composer={{
        nodes,
        placeholder: 'Type a message',
        disabled: false,
        onNodesChange,
      }}
      hint={null}
      toolbar={{
        addMenuLabel: 'Add content',
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
          onStop: vi.fn(),
        },
      }}
    />
  );
}

describe('ChatInputBar IME external synchronization', () => {
  it('keeps the composer DOM and applies a send clear after composition ends', async () => {
    const onNodesChange = vi.fn();
    const { rerender } = render(createInputBar(
      [createChatComposerTextNode('已经发送的消息')],
      onNodesChange,
    ));
    const textbox = screen.getByRole('textbox');
    fireEvent.focus(textbox);
    fireEvent.compositionStart(textbox);

    rerender(createInputBar([], onNodesChange));

    expect(screen.getByRole('textbox')).toBe(textbox);
    expect(textbox.textContent).toBe('已经发送的消息');

    fireEvent.compositionEnd(textbox);

    await waitFor(() => expect(textbox.textContent).toBe(''));
    expect(screen.getByRole('textbox')).toBe(textbox);
    expect(onNodesChange).not.toHaveBeenCalledWith([
      expect.objectContaining({ type: 'text', text: '已经发送的消息' }),
    ]);
    expect(window.getSelection()?.anchorOffset).toBe(0);
    expect(window.getSelection()?.focusOffset).toBe(0);
  });
});
