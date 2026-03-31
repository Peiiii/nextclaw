import { useRef, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ChatInputBar, type ChatInputBarHandle } from './chat-input-bar';
import type { ChatComposerNode, ChatInputBarProps } from '../../view-models/chat-ui.types';
import { createChatComposerTextNode, createChatComposerTokenNode } from './chat-composer.utils';

function setCursorToEnd(element: HTMLElement, text: string) {
  const textNode = element.firstChild;
  if (!textNode) {
    return;
  }
  const selection = window.getSelection();
  const range = document.createRange();
  const offset = Math.min(text.length, textNode.textContent?.length ?? 0);
  range.setStart(textNode, offset);
  range.setEnd(textNode, offset);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function setCursorOffset(element: HTMLElement, offset: number) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const textNode = walker.nextNode();
  if (!textNode) {
    return;
  }
  const selection = window.getSelection();
  const range = document.createRange();
  const boundedOffset = Math.min(offset, textNode.textContent?.length ?? 0);
  range.setStart(textNode, boundedOffset);
  range.setEnd(textNode, boundedOffset);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

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

function SlashMenuHarness() {
  const [nodes, setNodes] = useState<ChatComposerNode[]>([createChatComposerTextNode('')]);

  return (
    <ChatInputBar
      {...createInputBarProps({
        composer: {
          nodes,
          placeholder: 'Type a message',
          disabled: false,
          onNodesChange: setNodes
        },
        slashMenu: {
          isLoading: false,
          items: [
            {
              key: 'web-search',
              title: 'Web Search',
              subtitle: 'Skill',
              description: 'Search the web',
              detailLines: []
            }
          ],
          texts: {
            slashLoadingLabel: 'Loading',
            slashSectionLabel: 'Skills',
            slashEmptyLabel: 'No result',
            slashHintLabel: 'Type /',
            slashSkillHintLabel: 'Enter to add'
          }
        }
      })}
    />
  );
}

function ExistingSkillTokenHarness() {
  const [nodes, setNodes] = useState<ChatComposerNode[]>([
    createChatComposerTokenNode({ tokenKind: 'skill', tokenKey: 'web-search', label: 'Web Search' }),
    createChatComposerTextNode('')
  ]);

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

function FileTokenInsertionHarness() {
  const [nodes, setNodes] = useState<ChatComposerNode[]>([createChatComposerTextNode('Hello')]);
  const inputRef = useRef<ChatInputBarHandle | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.insertFileToken('sample-image', 'sample.png')}
      >
        Insert image
      </button>
      <ChatInputBar
        ref={inputRef}
        {...createInputBarProps({
          composer: {
            nodes,
            placeholder: 'Type a message',
            disabled: false,
            onNodesChange: setNodes
          }
        })}
      />
    </>
  );
}

it('keeps slash input single when the browser mutates the contenteditable DOM', () => {
  render(<SlashMenuHarness />);

  const textbox = screen.getByRole('textbox');
  fireEvent.focus(textbox);
  textbox.textContent = '/';
  setCursorToEnd(textbox, '/');
  fireEvent.input(textbox);

  expect(textbox.textContent).toBe('/');
});

it('keeps the slash menu dismissed after escape until slash mode exits', () => {
  render(<SlashMenuHarness />);

  const textbox = screen.getByRole('textbox');
  fireEvent.focus(textbox);

  textbox.textContent = '/';
  setCursorToEnd(textbox, '/');
  fireEvent.input(textbox);
  expect(screen.getByRole('dialog')).toBeTruthy();

  fireEvent.keyDown(textbox, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();

  textbox.textContent = '/a';
  setCursorToEnd(textbox, '/a');
  fireEvent.input(textbox);
  expect(screen.queryByRole('dialog')).toBeNull();

  textbox.textContent = 'plain text';
  setCursorToEnd(textbox, 'plain text');
  fireEvent.input(textbox);

  textbox.textContent = '/b';
  setCursorToEnd(textbox, '/b');
  fireEvent.input(textbox);
  expect(screen.getByRole('dialog')).toBeTruthy();
});

it('renders inline skill tokens inside the composer surface', () => {
  render(
    <ChatInputBar
      {...createInputBarProps({
        composer: {
          nodes: [
            createChatComposerTokenNode({ tokenKind: 'skill', tokenKey: 'web-search', label: 'Web Search' }),
            createChatComposerTextNode('')
          ],
          placeholder: 'Type a message',
          disabled: false,
          onNodesChange: vi.fn()
        }
      })}
    />
  );

  expect(screen.getByRole('textbox')).toBeTruthy();
  expect(screen.getByText('Web Search')).toBeTruthy();
});

it('keeps an existing skill token when fallback input appends plain text', () => {
  render(<ExistingSkillTokenHarness />);

  const textbox = screen.getByRole('textbox');
  fireEvent.focus(textbox);
  textbox.appendChild(document.createTextNode('a'));
  fireEvent.input(textbox);

  expect(screen.getByText('Web Search')).toBeTruthy();
  expect(textbox.textContent).toContain('a');
  expect(textbox.querySelector('[data-composer-token-key="web-search"]')).toBeTruthy();
});

it('forwards pasted files to the attachment handler', () => {
  const onFilesAdd = vi.fn();

  render(
    <ChatInputBar
      {...createInputBarProps({
        composer: {
          nodes: [createChatComposerTextNode('')],
          placeholder: 'Type a message',
          disabled: false,
          onNodesChange: vi.fn(),
          onFilesAdd,
        }
      })}
    />
  );

  const textbox = screen.getByRole('textbox');
  const file = new File(['image-bytes'], 'sample.png', { type: 'image/png' });
  fireEvent.paste(textbox, {
    clipboardData: {
      files: [file],
      getData: () => '',
    },
  });

  expect(onFilesAdd).toHaveBeenCalledWith([file]);
});

it('inserts a file token at the saved caret position', async () => {
  render(<FileTokenInsertionHarness />);

  const textbox = screen.getByRole('textbox');
  fireEvent.focus(textbox);
  setCursorOffset(textbox, 2);
  fireEvent.mouseUp(textbox);

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Insert image' }));
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  });

  const token = textbox.querySelector('[data-composer-token-key="sample-image"]');
  expect(token).toBeTruthy();
  expect(token?.previousSibling?.textContent).toBe('He');
  expect(token?.nextSibling?.textContent).toBe('llo');
  expect(token?.className).toContain('rounded-lg');
  expect(token?.textContent).toContain('sample.png');
  expect(token?.textContent).not.toContain('PNG');

  const selection = window.getSelection();
  expect(selection?.anchorNode).toBe(textbox);
  expect(selection?.anchorOffset).toBe(2);
});

it('does not commit intermediate IME composition text before composition ends', () => {
  const onNodesChange = vi.fn();

  render(
    <ChatInputBar
      {...createInputBarProps({
        composer: {
          nodes: [createChatComposerTextNode('')],
          placeholder: 'Type a message',
          disabled: false,
          onNodesChange
        }
      })}
    />
  );

  const textbox = screen.getByRole('textbox');
  fireEvent.focus(textbox);
  fireEvent.compositionStart(textbox);
  textbox.textContent = 'n';
  fireEvent.input(textbox, {
    data: 'n',
    inputType: 'insertCompositionText',
    isComposing: true
  });

  expect(onNodesChange).not.toHaveBeenCalled();

  textbox.textContent = '你';
  fireEvent.compositionEnd(textbox, { data: '你' });

  expect(onNodesChange).toHaveBeenCalled();
  expect(onNodesChange.mock.calls[onNodesChange.mock.calls.length - 1]?.[0]).toEqual([
    expect.objectContaining({ type: 'text', text: '你' })
  ]);
});

it('removes the last selected chip when backspace is pressed on an empty draft', () => {
  const onNodesChange = vi.fn();

  render(
    <ChatInputBar
      {...createInputBarProps({
        composer: {
          nodes: [
            createChatComposerTokenNode({ tokenKind: 'skill', tokenKey: 'web-search', label: 'Web Search' }),
            createChatComposerTokenNode({ tokenKind: 'skill', tokenKey: 'docs', label: 'Docs' }),
            createChatComposerTextNode('')
          ],
          placeholder: 'Type a message',
          disabled: false,
          onNodesChange
        }
      })}
    />
  );

  const textbox = screen.getByRole('textbox');
  fireEvent.focus(textbox);
  fireEvent.keyDown(textbox, { key: 'Backspace' });

  expect(onNodesChange).toHaveBeenCalled();
  const lastCall = onNodesChange.mock.calls[onNodesChange.mock.calls.length - 1]?.[0];
  expect(lastCall).toEqual([
    expect.objectContaining({ type: 'token', tokenKey: 'web-search' })
  ]);
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

it('renders disabled accessories as icon-only triggers when tooltip copy exists', () => {
  render(
    <ChatInputBar
      {...createInputBarProps({
        toolbar: {
          selects: [],
          accessories: [
            {
              key: 'attach',
              label: 'Attach file',
              icon: 'paperclip',
              iconOnly: true,
              disabled: true,
              tooltip: 'Coming soon'
            }
          ],
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
        }
      })}
    />
  );

  const button = screen.getByRole('button', { name: 'Attach file' });
  const trigger = button.parentElement as HTMLElement;

  expect(button).toBeTruthy();
  expect(screen.queryByText('Attach file')).toBeNull();
  expect(screen.queryByText('Coming soon')).toBeNull();
  expect(trigger.tagName).toBe('SPAN');
});
