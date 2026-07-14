import { useRef, useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  ChatInputBar,
  type ChatInputBarHandle,
} from '@agent-chat-ui/components/chat/ui/chat-input-bar/chat-input-bar';
import { deleteChatComposerContent } from '@agent-chat-ui/components/chat/ui/chat-input-bar/lexical/chat-composer-lexical-adapter';
import { createChatComposerTextNode } from '@agent-chat-ui/components/chat/ui/chat-input-bar/chat-composer.utils';
import { replaceChatComposerSelectionWithText } from '@agent-chat-ui/components/chat/ui/chat-input-bar/lexical/chat-composer-lexical-adapter';
import type { ChatComposerNode } from '@agent-chat-ui/components/chat/view-models/chat-ui.types';

Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
  value: vi.fn(() => ({
    bottom: 0,
    height: 0,
    left: 0,
    right: 0,
    top: 0,
    width: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })),
  writable: true,
});

function SlashQueryDeletionHarness() {
  const [nodes, setNodes] = useState<ChatComposerNode[]>([createChatComposerTextNode('/agent')]);
  const inputRef = useRef<ChatInputBarHandle | null>(null);

  return (
    <>
      <button type="button" onClick={() => inputRef.current?.focusComposerAtEnd()}>
        Focus slash query
      </button>
      <ChatInputBar
        ref={inputRef}
        composer={{
          disabled: false,
          nodes,
          onNodesChange: setNodes,
          placeholder: 'Type a message',
        }}
        hint={null}
        toolbar={{
          actions: {
            canStopGeneration: false,
            isSending: false,
            onSend: vi.fn(),
            onStop: vi.fn(),
            sendButtonLabel: 'Send',
            sendDisabled: false,
            stopButtonLabel: 'Stop',
            stopDisabled: true,
            stopHint: 'Stop unavailable',
          },
          selects: [],
        }}
      />
    </>
  );
}

describe('ChatInputBar selection behavior', () => {
  it('keeps the caret after the remaining slash query across consecutive backspaces', async () => {
    render(<SlashQueryDeletionHarness />);

    const textbox = screen.getByRole('textbox');
    fireEvent.click(screen.getByRole('button', { name: 'Focus slash query' }));
    await waitFor(() => expect(textbox.textContent).toBe('/agent'));
    expect(window.getSelection()?.anchorOffset).toBe(6);
    expect(window.getSelection()?.focusOffset).toBe(6);

    for (const expectedText of ['/agen', '/age', '/ag', '/a']) {
      fireEvent.keyDown(textbox, { key: 'Backspace' });
      await waitFor(() => expect(textbox.textContent).toBe(expectedText));
      const selection = window.getSelection();
      expect(selection?.anchorOffset).toBe(expectedText.length);
      expect(selection?.focusOffset).toBe(expectedText.length);
    }
  });

  it('deletes the whole selected draft instead of only the last character', () => {
    const snapshot = deleteChatComposerContent({
      direction: 'backward',
      nodes: [createChatComposerTextNode('hello world')],
      selection: { start: 0, end: 11 },
    });

    expect(snapshot.nodes).toEqual([
      expect.objectContaining({ type: 'text', text: '' }),
    ]);
    expect(snapshot.selection).toEqual({ start: 0, end: 0 });
  });

  it('deletes a backward selection as a full range', () => {
    const snapshot = deleteChatComposerContent({
      direction: 'backward',
      nodes: [createChatComposerTextNode('hello world')],
      selection: { start: 11, end: 0 },
    });

    expect(snapshot.nodes).toEqual([
      expect.objectContaining({ type: 'text', text: '' }),
    ]);
    expect(snapshot.selection).toEqual({ start: 0, end: 0 });
  });

  it('replaces a backward selection instead of appending text after it', () => {
    const snapshot = replaceChatComposerSelectionWithText({
      nodes: [createChatComposerTextNode('hello world')],
      selection: { start: 11, end: 6 },
      text: 'NextClaw',
    });

    expect(snapshot.nodes).toEqual([
      expect.objectContaining({ type: 'text', text: 'hello NextClaw' }),
    ]);
    expect(snapshot.selection).toEqual({ start: 14, end: 14 });
  });
});
