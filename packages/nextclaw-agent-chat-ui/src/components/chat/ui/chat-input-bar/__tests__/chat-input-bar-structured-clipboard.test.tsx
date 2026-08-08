import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChatInputBar } from '@agent-chat-ui/components/chat/ui/chat-input-bar/chat-input-bar';
import {
  createChatComposerTextNode,
  createChatComposerTokenNode,
} from '@agent-chat-ui/components/chat/ui/chat-input-bar/chat-composer.utils';
import { CHAT_COMPOSER_CLIPBOARD_MIME_TYPE } from '@agent-chat-ui/components/chat/ui/chat-input-bar/lexical/chat-composer-clipboard.utils';
import type {
  ChatComposerNode,
  ChatInputBarProps,
} from '@agent-chat-ui/components/chat/view-models/chat-ui.types';

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

Object.defineProperty(globalThis, 'ClipboardEvent', {
  configurable: true,
  value: Event,
});

function createInputBarProps(
  nodes: ChatComposerNode[],
  onNodesChange: (nodes: ChatComposerNode[]) => void,
): ChatInputBarProps {
  return {
    composer: {
      disabled: false,
      nodes,
      onNodesChange,
      placeholder: 'Type a message',
    },
    hint: null,
    slashMenu: {
      isLoading: false,
      items: [],
      texts: {
        slashEmptyLabel: 'No result',
        slashHintLabel: 'Type /',
        slashLoadingLabel: 'Loading',
        slashSectionLabel: 'Skills',
        slashSkillHintLabel: 'Enter to add',
      },
    },
    toolbar: {
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
    },
  };
}

const sourceNodes = [
  createChatComposerTextNode('Explain '),
  createChatComposerTokenNode({
    tokenKind: 'workspace_excerpt',
    tokenKey: 'docs/guide.md#excerpt-1',
    label: 'guide.md',
    data: {
      path: 'docs/guide.md',
      excerpt: 'Selected source text.',
      startLine: 12,
      endLine: 13,
    },
  }),
  createChatComposerTextNode(' please'),
];

function StructuredClipboardHarness() {
  const [source, setSource] = useState<ChatComposerNode[]>(sourceNodes);
  const [target, setTarget] = useState<ChatComposerNode[]>([
    createChatComposerTextNode(''),
  ]);
  return (
    <>
      <section aria-label="Source composer">
        <ChatInputBar {...createInputBarProps(source, setSource)} />
      </section>
      <section aria-label="Target composer">
        <ChatInputBar {...createInputBarProps(target, setTarget)} />
      </section>
    </>
  );
}

async function selectComposerContents(textbox: HTMLElement) {
  const paragraph = textbox.querySelector('p');
  expect(paragraph).toBeTruthy();
  textbox.focus();
  const range = document.createRange();
  range.selectNodeContents(paragraph!);
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
  fireEvent(document, new Event('selectionchange'));
  await act(async () => Promise.resolve());
}

function createClipboardData() {
  const values = new Map<string, string>();
  return {
    files: [],
    getData: (type: string) => values.get(type) ?? '',
    setData: vi.fn((type: string, value: string) => {
      values.set(type, value);
    }),
    values,
  };
}

it('copies and pastes mixed text and references without flattening structured tokens', async () => {
  render(<StructuredClipboardHarness />);
  const [source, target] = screen.getAllByRole('textbox');
  await selectComposerContents(source!);
  const clipboardData = createClipboardData();

  fireEvent.copy(source!, { clipboardData });

  expect(clipboardData.values.get(CHAT_COMPOSER_CLIPBOARD_MIME_TYPE)).toContain(
    'workspace_excerpt',
  );
  expect(clipboardData.values.get('text/plain')).toBe(
    'Explain [guide.md L12–13]\nSelected source text. please',
  );

  target!.focus();
  const targetParagraph = target!.querySelector('p');
  const targetRange = document.createRange();
  targetRange.selectNodeContents(targetParagraph!);
  targetRange.collapse(false);
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(targetRange);
  fireEvent(document, new Event('selectionchange'));
  await act(async () => Promise.resolve());
  fireEvent.paste(target!, { clipboardData });

  await waitFor(() => {
    expect(target!.querySelector('[data-composer-token-kind="workspace_excerpt"]')).toBeTruthy();
  });
  expect(target!.textContent).toContain('Explain');
  expect(target!.textContent).toContain('guide.md');
  expect(target!.textContent).toContain('please');
});

it('does not delete a cut selection when writing to the clipboard fails', async () => {
  render(<StructuredClipboardHarness />);
  const source = screen.getAllByRole('textbox')[0]!;
  await selectComposerContents(source);
  const clipboardData = {
    files: [],
    getData: () => '',
    setData: vi.fn(() => {
      throw new Error('clipboard unavailable');
    }),
  };

  fireEvent.cut(source, { clipboardData });

  expect(source.querySelector('[data-composer-token-kind="workspace_excerpt"]')).toBeTruthy();
  expect(source.textContent).toContain('Explain');
  expect(source.textContent).toContain('please');
});

it('deletes a mixed cut selection only after both clipboard formats are written', async () => {
  render(<StructuredClipboardHarness />);
  const source = screen.getAllByRole('textbox')[0]!;
  await selectComposerContents(source);
  const clipboardData = createClipboardData();

  fireEvent.cut(source, { clipboardData });

  expect(clipboardData.setData).toHaveBeenCalledTimes(2);
  expect(clipboardData.values.get('text/plain')).toContain('Selected source text.');
  expect(clipboardData.values.get(CHAT_COMPOSER_CLIPBOARD_MIME_TYPE)).toContain(
    'workspace_excerpt',
  );
  await waitFor(() => {
    expect(source.querySelector('[data-composer-token-kind="workspace_excerpt"]')).toBeNull();
  });
  expect(source.textContent).not.toContain('Explain');
  expect(source.textContent).not.toContain('please');
});

it('falls back to ordinary plain text when structured clipboard data is invalid', async () => {
  render(<StructuredClipboardHarness />);
  const target = screen.getAllByRole('textbox')[1]!;
  target.focus();
  const clipboardData = createClipboardData();
  clipboardData.values.set(CHAT_COMPOSER_CLIPBOARD_MIME_TYPE, '{invalid');
  clipboardData.values.set('text/plain', 'fallback text');

  fireEvent.paste(target, { clipboardData });

  await waitFor(() => expect(target.textContent).toContain('fallback text'));
  expect(target.querySelector('[data-composer-node-type="token"]')).toBeNull();
});
