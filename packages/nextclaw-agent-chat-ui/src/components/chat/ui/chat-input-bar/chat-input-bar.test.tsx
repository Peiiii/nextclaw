import { useRef, useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChatInputBar, type ChatInputBarHandle } from './chat-input-bar';
import type { ChatComposerNode, ChatInputBarProps } from '../../view-models/chat-ui.types';
import { createChatComposerTextNode, createChatComposerTokenNode, resolveChatComposerSlashTrigger } from './chat-composer.utils';
import { insertFileTokenIntoChatComposer, insertSkillTokenIntoChatComposer } from './lexical/chat-composer-lexical-adapter';
import { handleLexicalComposerKeyboardCommand } from './lexical/chat-composer-lexical-controller';

Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  value: vi.fn(),
  writable: true,
});

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

async function syncSelectionChange() {
  document.dispatchEvent(new Event('selectionchange'));
  await Promise.resolve();
}

async function insertText(textbox: HTMLElement, text: string) {
  await act(async () => {
    for (const character of text) {
      const event = new Event('beforeinput', {
        bubbles: true,
        cancelable: true,
      }) as Event & {
        data?: string;
        inputType?: string;
      };
      event.data = character;
      event.inputType = 'insertText';
      textbox.dispatchEvent(event);
      await Promise.resolve();
    }
  });
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
              detailLines: [],
              value: 'web-search'
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

function SlashMenuSelectionHarness(props: { onSelectItem: (value: string) => void }) {
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
          onSelectItem: (item) => {
            if (item.value) {
              props.onSelectItem(item.value);
            }
          },
          items: [
            {
              key: 'web-search',
              title: 'Web Search',
              subtitle: 'Skill',
              description: 'Search the web',
              detailLines: [],
              value: 'web-search'
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

function SkillPickerInsertionHarness() {
  const [nodes, setNodes] = useState<ChatComposerNode[]>([createChatComposerTextNode('')]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  return (
    <ChatInputBar
      {...createInputBarProps({
        composer: {
          nodes,
          placeholder: 'Type a message',
          disabled: false,
          onNodesChange: setNodes,
        },
        toolbar: {
          selects: [],
          skillPicker: {
            title: 'Skills',
            searchPlaceholder: 'Search skills',
            loadingLabel: 'Loading skills',
            emptyLabel: 'No skills',
            selectedKeys,
            options: [
              {
                key: 'web-search',
                label: 'Web Search',
                description: 'Search the web',
              },
            ],
            onSelectedKeysChange: setSelectedKeys,
          },
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
        },
      })}
    />
  );
}

it('detects a slash trigger for a single slash query', () => {
  expect(
    resolveChatComposerSlashTrigger(
      [createChatComposerTextNode('/')],
      { start: 1, end: 1 },
    ),
  ).toEqual({
    query: '',
    start: 0,
    end: 1,
  });
});

it('clears the slash trigger after the slash marker is deleted', () => {
  expect(
    resolveChatComposerSlashTrigger(
      [createChatComposerTextNode('/a')],
      { start: 2, end: 2 },
    ),
  ).toEqual({
    query: 'a',
    start: 0,
    end: 2,
  });

  expect(
    resolveChatComposerSlashTrigger(
      [createChatComposerTextNode('a')],
      { start: 1, end: 1 },
    ),
  ).toBeNull();
});

it('replaces the current slash query with a skill token', () => {
  const snapshot = insertSkillTokenIntoChatComposer({
    label: 'Web Search',
    nodes: [createChatComposerTextNode('/web')],
    selection: { start: 4, end: 4 },
    tokenKey: 'web-search',
  });

  expect(snapshot.nodes).toEqual([
    expect.objectContaining({
      type: 'token',
      tokenKind: 'skill',
      tokenKey: 'web-search',
      label: 'Web Search',
    }),
  ]);
  expect(snapshot.selection).toEqual({ start: 1, end: 1 });
});

it('renders inline skill tokens inside the composer surface', async () => {
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
  await waitFor(() => expect(screen.getByText('Web Search')).toBeTruthy());
});

it('consumes enter when inserting a slash-selected skill and restores composer focus', () => {
  const publishSnapshot = vi.fn();
  const onSlashItemSelect = vi.fn();
  const preventDefault = vi.fn();
  const item = {
    key: 'web-search',
    title: 'Web Search',
    subtitle: 'Skill',
    description: 'Search the web',
    detailLines: [],
    value: 'web-search',
  };

  const handled = handleLexicalComposerKeyboardCommand({
    actions: {
      isSending: false,
      canStopGeneration: false,
      onSend: vi.fn(),
      onStop: vi.fn(),
    },
    activeSlashIndex: 0,
    nativeEvent: {
      key: 'Enter',
      shiftKey: false,
      isComposing: false,
      preventDefault,
    } as unknown as KeyboardEvent,
    onSlashActiveIndexChange: vi.fn(),
    onSlashItemSelect,
    onSlashOpenChange: vi.fn(),
    onSlashQueryChange: vi.fn(),
    publishSnapshot,
    slashItems: [item],
    snapshot: {
      nodes: [createChatComposerTextNode('/')],
      selection: { start: 1, end: 1 },
    },
  });

  expect(handled).toBe(true);
  expect(preventDefault).toHaveBeenCalled();
  expect(onSlashItemSelect).toHaveBeenCalledWith(item);
  expect(publishSnapshot).toHaveBeenCalledWith(
    {
      nodes: [
        expect.objectContaining({
          type: 'token',
          tokenKind: 'skill',
          tokenKey: 'web-search',
          label: 'Web Search',
        }),
      ],
      selection: { start: 1, end: 1 },
    },
    { focusAfterSync: true },
  );
});

it('shows a selected skill inside the composer after choosing it from the skill picker', async () => {
  render(<SkillPickerInsertionHarness />);

  fireEvent.click(screen.getByRole('button', { name: /skills/i }));
  fireEvent.click(await screen.findByRole('option', { name: /web search/i }));

  await waitFor(() => expect(screen.getByText('Web Search')).toBeTruthy());
  expect(screen.getByRole('textbox').querySelector('[data-composer-token-key="web-search"]')).toBeTruthy();
});

it('keeps an existing skill token when typing plain text after it', async () => {
  render(<ExistingSkillTokenHarness />);

  const textbox = screen.getByRole('textbox');
  fireEvent.focus(textbox);
  await insertText(textbox, 'a');

  await waitFor(() => expect(screen.getByText('Web Search')).toBeTruthy());
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

it('inserts a file token at the saved caret position', () => {
  const snapshot = insertFileTokenIntoChatComposer({
    label: 'sample.png',
    nodes: [createChatComposerTextNode('Hello')],
    selection: { start: 2, end: 2 },
    tokenKey: 'sample-image',
  });

  expect(snapshot.nodes).toEqual([
    expect.objectContaining({ type: 'text', text: 'He' }),
    expect.objectContaining({
      type: 'token',
      tokenKind: 'file',
      tokenKey: 'sample-image',
      label: 'sample.png',
    }),
    expect.objectContaining({ type: 'text', text: 'llo' }),
  ]);
  expect(snapshot.selection).toEqual({ start: 3, end: 3 });
});

it('renders a file token inside the composer after an imperative insert', async () => {
  render(<FileTokenInsertionHarness />);

  fireEvent.click(screen.getByRole('button', { name: 'Insert image' }));

  await waitFor(() => expect(screen.getByText('sample.png')).toBeTruthy());
  expect(screen.getByRole('textbox').querySelector('[data-composer-token-key="sample-image"]')).toBeTruthy();
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

  expect(onNodesChange).not.toHaveBeenCalled();

  fireEvent.compositionEnd(textbox, { data: '你' });

  expect(onNodesChange).toHaveBeenCalled();
  expect(onNodesChange.mock.calls[onNodesChange.mock.calls.length - 1]?.[0]).toEqual([
    expect.objectContaining({ type: 'text', text: '你' })
  ]);
});

it('ignores Windows IME precomposition key events without crashing', () => {
  render(
    <ChatInputBar
      {...createInputBarProps({
        composer: {
          nodes: [createChatComposerTextNode('')],
          placeholder: 'Type a message',
          disabled: false,
          onNodesChange: vi.fn()
        }
      })}
    />
  );

  const textbox = screen.getByRole('textbox');
  fireEvent.focus(textbox);

  fireEvent.keyDown(textbox, {
    key: 'Process',
    keyCode: 229,
      which: 229
  });

  fireEvent.keyUp(textbox, {
    key: 'Process',
    keyCode: 229,
      which: 229
  });

  expect(screen.getByRole('textbox')).toBeTruthy();
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

it('keeps the model dropdown narrower on mobile while preserving desktop width', async () => {
  render(
    <ChatInputBar
      {...createInputBarProps({
        toolbar: {
          selects: [
            {
              key: 'model',
              value: 'minimax/minimax-m2.7',
              placeholder: 'Select model',
              selectedLabel: 'MiniMax/MiniMax-M2.7',
              options: [
                {
                  value: 'minimax/minimax-m2.7',
                  label: 'MiniMax/MiniMax-M2.7',
                },
              ],
              onValueChange: vi.fn(),
            },
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
            onStop: vi.fn(),
          },
        },
      })}
    />
  );

  fireEvent.click(screen.getByRole('combobox'));

  const listbox = await screen.findByRole('listbox');
  expect(listbox.className).toContain('w-[min(18rem,calc(100vw-1rem))]');
  expect(listbox.className).toContain('sm:w-[320px]');
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

it('collapses long send errors and reveals the full text in a details popover', async () => {
  const longError =
    'NotFoundError [HTTP 404]\nProvider: custom Model: MiniMax-M2.7\nEndpoint: https://dashscope.aliyuncs.com/compatible-mode/v1\nThis model does not exist or you do not have access to it.';

  render(
    <ChatInputBar
      {...createInputBarProps({
        toolbar: {
          selects: [],
          actions: {
            sendError: longError,
            sendErrorDetailsLabel: 'View details',
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

  expect(screen.getByText(/NotFoundError \[HTTP 404\]/)).toBeTruthy();
  expect(
    screen.queryByText(/Endpoint: https:\/\/dashscope\.aliyuncs\.com\/compatible-mode\/v1/)
  ).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'View details' }));

  await waitFor(() => {
    expect(
      screen.getByText(/Endpoint: https:\/\/dashscope\.aliyuncs\.com\/compatible-mode\/v1/)
    ).toBeTruthy();
  });
});

it('reveals the original send error on hover even when the summary stays on one line', async () => {
  const hoverError =
    'timeout while contacting upstream\nrequest_id=req-123\nprovider=narp-stdio';

  render(
    <ChatInputBar
      {...createInputBarProps({
        toolbar: {
          selects: [],
          actions: {
            sendError: hoverError,
            sendErrorDetailsLabel: 'View details',
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

  expect(screen.getByRole('button', { name: 'View details' })).toBeTruthy();
  expect((document.querySelector('span[title]') as HTMLElement | null)?.getAttribute('title')).toBe(hoverError);
});
