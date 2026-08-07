import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createChatComposerTextNode } from '@nextclaw/agent-chat-ui';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';

import { ChatMessageInlineEditor } from '@/features/chat/features/message/components/chat-message-inline-editor';
import type { SessionMessageComposerSnapshot } from '@/features/chat/features/conversation/utils/session-message-composer.utils';

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

function EditorHarness({ text }: { text: string }) {
  const [snapshot, setSnapshot] = useState<SessionMessageComposerSnapshot>({
    attachments: [],
    nodes: [createChatComposerTextNode(text)],
    selectedSkills: [],
    skillRecords: [],
    text,
  });
  return (
    <ChatMessageInlineEditor
      disabled={false}
      messageId="user-message-1"
      onCancel={vi.fn()}
      onChange={setSnapshot}
      onSave={vi.fn()}
      snapshot={snapshot}
    />
  );
}

it('focuses the editor with the caret at the end when editing starts', async () => {
  const text = 'Edit this message';
  render(<EditorHarness text={text} />);

  const editor = screen.getByRole('textbox');
  await waitFor(() => expect(document.activeElement).toBe(editor));
  expect(window.getSelection()?.anchorOffset).toBe(text.length);
  expect(window.getSelection()?.focusOffset).toBe(text.length);

  await userEvent.setup().type(editor, ',');

  await waitFor(() => expect(editor.textContent).toBe(`${text},`));
  expect(window.getSelection()?.anchorOffset).toBe(text.length + 1);
  expect(window.getSelection()?.focusOffset).toBe(text.length + 1);
});
