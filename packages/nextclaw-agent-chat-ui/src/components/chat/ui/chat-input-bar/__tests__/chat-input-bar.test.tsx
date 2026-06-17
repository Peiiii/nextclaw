import { useRef, useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChatInputBar, type ChatInputBarHandle } from '@agent-chat-ui/components/chat/ui/chat-input-bar/chat-input-bar';
import { createChatComposerTextNode, createChatComposerTokenNode, resolveChatComposerSlashTrigger } from '@agent-chat-ui/components/chat/ui/chat-input-bar/chat-composer.utils';
import { insertFileTokenIntoChatComposer, insertSkillTokenIntoChatComposer } from '@agent-chat-ui/components/chat/ui/chat-input-bar/lexical/chat-composer-lexical-adapter';
import { handleLexicalComposerKeyboardCommand } from '@agent-chat-ui/components/chat/ui/chat-input-bar/lexical/chat-composer-lexical-controller';
import type { ChatComposerNode, ChatInputBarProps, ChatToolbarSelect } from '@agent-chat-ui/components/chat/view-models/chat-ui.types';

type ChatInputBarPropsOverrides = Omit<Partial<ChatInputBarProps>, 'composer' | 'toolbar'> & {
  composer?: Partial<ChatInputBarProps['composer']>;
  toolbar?: Omit<Partial<ChatInputBarProps['toolbar']>, 'actions'> & {
    actions?: Partial<ChatInputBarProps['toolbar']['actions']>;
  };
};

Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  value: vi.fn(),
  writable: true,
});

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

function createInputBarProps(overrides: ChatInputBarPropsOverrides = {}): ChatInputBarProps {
  const defaults: ChatInputBarProps = {
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
  };

  return {
    ...defaults,
    ...overrides,
    composer: {
      ...defaults.composer,
      ...overrides.composer,
    },
    slashMenu: overrides.slashMenu ?? defaults.slashMenu,
    toolbar: {
      ...defaults.toolbar,
      ...overrides.toolbar,
      actions: {
        ...defaults.toolbar.actions,
        ...overrides.toolbar?.actions,
      },
    },
  };
}

function createInputBarElement(overrides?: ChatInputBarPropsOverrides) {
  return <ChatInputBar {...createInputBarProps(overrides)} />;
}

function renderInputBar(overrides?: ChatInputBarPropsOverrides) {
  return render(createInputBarElement(overrides));
}

function createComposer(nodes: ChatComposerNode[], overrides: Omit<Partial<ChatInputBarProps['composer']>, 'nodes'> = {}) {
  return { nodes, onNodesChange: vi.fn(), ...overrides };
}

function createModelSelect(overrides: Partial<ChatToolbarSelect> = {}): ChatToolbarSelect {
  return {
    key: 'model',
    value: 'minimax/minimax-m2.7',
    placeholder: 'Select model',
    selectedLabel: 'MiniMax/MiniMax-M2.7',
    options: [{ value: 'minimax/minimax-m2.7', label: 'MiniMax/MiniMax-M2.7' }],
    onValueChange: vi.fn(),
    ...overrides,
  };
}

function ExistingSkillTokenHarness() {
  const [nodes, setNodes] = useState<ChatComposerNode[]>([
    createChatComposerTokenNode({ tokenKind: 'skill', tokenKey: 'web-search', label: 'Web Search' }),
    createChatComposerTextNode('')
  ]);

  return (
    <ChatInputBar
      {...createInputBarProps({
        composer: createComposer(nodes, { onNodesChange: setNodes })
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
          composer: createComposer(nodes, { onNodesChange: setNodes })
        })}
      />
    </>
  );
}

function FocusAtEndHarness() {
  const [nodes, setNodes] = useState<ChatComposerNode[]>([createChatComposerTextNode('Hello')]);
  const inputRef = useRef<ChatInputBarHandle | null>(null);
  const applyPromptAndFocusEnd = () => {
    const nextNodes = [createChatComposerTextNode('Hello prompt')];
    setNodes(nextNodes);
    inputRef.current?.focusComposerAtEnd(nextNodes);
  };

  return (
    <>
      <button type="button" onClick={() => inputRef.current?.focusComposerAtEnd()}>
        Focus end
      </button>
      <button type="button" onClick={applyPromptAndFocusEnd}>
        Apply prompt and focus end
      </button>
      <ChatInputBar
        ref={inputRef}
        {...createInputBarProps({
          composer: createComposer(nodes, { onNodesChange: setNodes })
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
        composer: createComposer(nodes, { onNodesChange: setNodes }),
        toolbar: {
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
  renderInputBar({
    composer: createComposer([
      createChatComposerTokenNode({ tokenKind: 'skill', tokenKey: 'web-search', label: 'Web Search' }),
      createChatComposerTextNode('')
    ])
  });

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
  fireEvent.click(await screen.findByRole('button', { name: /add web search/i }));

  await waitFor(() => expect(screen.getByText('Web Search')).toBeTruthy());
  expect(screen.getByRole('textbox').querySelector('[data-composer-token-key="web-search"]')).toBeTruthy();
});

it('keeps the skill picker panel constrained to the available viewport height', async () => {
  render(<SkillPickerInsertionHarness />);

  fireEvent.click(screen.getByRole('button', { name: /skills/i }));

  const listbox = await screen.findByRole('listbox');
  expect(listbox.className).toContain('flex-1');
  expect(listbox.className).toContain('overflow-y-auto');
  const panelStyle = listbox.closest('[data-state="open"]')?.getAttribute('style') ?? '';
  expect(panelStyle).toContain('24rem');
  expect(panelStyle).toContain('--radix-popover-content-available-height');
  expect(panelStyle).toContain('100vh');
  expect(panelStyle).toContain('2rem');
  expect(listbox.className).toContain('overscroll-contain');
});

it('keeps skill option text selectable without toggling the skill', async () => {
  render(<SkillPickerInsertionHarness />);

  fireEvent.click(screen.getByRole('button', { name: /skills/i }));
  fireEvent.click(await screen.findByText('Search the web'));

  expect(screen.getByText('Search the web')).toBeTruthy();
  expect(screen.getByRole('textbox').querySelector('[data-composer-token-key="web-search"]')).toBeNull();
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

  renderInputBar({
    composer: createComposer([createChatComposerTextNode('')], {
      onFilesAdd,
    })
  });

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

it('focuses the composer at the end through the imperative handle', async () => {
  render(<FocusAtEndHarness />);

  const textbox = screen.getByRole('textbox');
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Focus end' }));
    await Promise.resolve();
  });
  await waitFor(() => expect(document.activeElement).toBe(textbox));

  await waitFor(() => {
    const selection = window.getSelection();
    expect(selection?.anchorOffset).toBe(5);
    expect(selection?.focusOffset).toBe(5);
  });
});

it('focuses at the end of externally supplied composer nodes', async () => {
  render(<FocusAtEndHarness />);

  const textbox = screen.getByRole('textbox');
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Apply prompt and focus end' }));
    await Promise.resolve();
  });

  await waitFor(() => expect(document.activeElement).toBe(textbox));
  await waitFor(() => expect(textbox.textContent).toBe('Hello prompt'));
  await waitFor(() => {
    const selection = window.getSelection();
    expect(selection?.anchorOffset).toBe(12);
    expect(selection?.focusOffset).toBe(12);
  });
});

it('does not commit intermediate IME composition text before composition ends', () => {
  const onNodesChange = vi.fn();

  renderInputBar({
    composer: createComposer([createChatComposerTextNode('')], { onNodesChange })
  });

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
  renderInputBar({
    composer: createComposer([createChatComposerTextNode('')])
  });

  const textbox = screen.getByRole('textbox');
  fireEvent.focus(textbox);
  const imePrecompositionEvent = { key: 'Process', keyCode: 229, which: 229 };

  fireEvent.keyDown(textbox, imePrecompositionEvent);
  fireEvent.keyUp(textbox, imePrecompositionEvent);

  expect(screen.getByRole('textbox')).toBeTruthy();
});

it('removes the last selected chip when backspace is pressed on an empty draft', () => {
  const onNodesChange = vi.fn();

  renderInputBar({
    composer: createComposer(
      [
        createChatComposerTokenNode({ tokenKind: 'skill', tokenKey: 'web-search', label: 'Web Search' }),
        createChatComposerTokenNode({ tokenKind: 'skill', tokenKey: 'docs', label: 'Docs' }),
        createChatComposerTextNode('')
      ],
      { onNodesChange }
    )
  });

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
  const { rerender } = renderInputBar({
    toolbar: {
      actions: {
        onSend,
        onStop
      }
    }
  });

  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  expect(onSend).toHaveBeenCalled();
  expect(screen.queryByTestId('chat-stop-icon')).toBeNull();

  rerender(
    createInputBarElement({
      toolbar: {
        actions: {
          isSending: true,
          canStopGeneration: true,
          sendDisabled: true,
          stopDisabled: false,
          onSend,
          onStop
        }
      }
    })
  );

  expect(screen.getByTestId('chat-stop-icon').className).toContain('bg-gray-700');
  fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
  expect(onStop).toHaveBeenCalled();
});

it('keeps the model dropdown narrower on mobile while preserving desktop width', async () => {
  renderInputBar({
    toolbar: {
      selects: [createModelSelect()],
    },
  });

  fireEvent.click(screen.getByRole('combobox'));

  const listbox = await screen.findByRole('listbox');
  expect(listbox.className).toContain('w-[min(18rem,calc(100vw-1rem))]');
  expect(listbox.className).toContain('sm:w-[320px]');
});

it('lets the toolbar wrap instead of forcing the model select to squeeze the send action', () => {
  renderInputBar({
    toolbar: {
      selects: [
        createModelSelect({
          value: 'deepseek/deepseek-v3.2-super-long-model-name',
          selectedLabel: 'DeepSeek/deepseek-v3.2-super-long-model-name',
          options: [],
        }),
      ],
      accessories: [{ key: 'attach', label: 'Attach file', icon: 'paperclip', iconOnly: true }],
    },
  });

  const modelTrigger = screen.getByRole('combobox');
  expect(document.querySelector('.nextclaw-chat-input-bar-shell')).toBeTruthy();
  expect(modelTrigger.className).toContain('basis-[12rem]');
  expect(modelTrigger.className).toContain('max-w-full');
  expect(modelTrigger.className).toContain('nextclaw-chat-toolbar-select-trigger');
  expect(screen.getByText('DeepSeek/deepseek-v3.2-super-long-model-name').className).toContain(
    'nextclaw-chat-toolbar-label',
  );
  expect(screen.getByRole('button', { name: 'Send' })).toBeTruthy();
});

it('renders disabled accessories as icon-only triggers when tooltip copy exists', () => {
  renderInputBar({
    toolbar: {
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
    }
  });

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

  renderInputBar({
    toolbar: {
      actions: {
        sendError: longError,
        sendErrorDetailsLabel: 'View details',
      }
    }
  });

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

  renderInputBar({
    toolbar: {
      actions: {
        sendError: hoverError,
        sendErrorDetailsLabel: 'View details',
      }
    }
  });

  expect(screen.getByRole('button', { name: 'View details' })).toBeTruthy();
  expect((document.querySelector('span[title]') as HTMLElement | null)?.getAttribute('title')).toBe(hoverError);
});

it('renders a subtle context window indicator without persistent percent text', () => {
  renderInputBar({
    toolbar: {
      actions: {
        contextWindow: {
          label: 'Context window',
          percentLabel: '38%',
          ratio: 0.38,
          tone: 'neutral',
          details: [
            { label: 'Used', value: '76k' },
            { label: 'Total', value: '200k' },
            { label: 'Available', value: '124k' }
          ]
        },
      }
    }
  });

  const indicator = screen.getByRole('button', { name: 'Context window' });
  expect(indicator).toBeTruthy();
  expect(indicator.className).toContain('rounded-lg');
  expect(indicator.querySelector('span')?.getAttribute('style')).toContain('#9ca3af');
  expect(screen.queryByText('38%')).toBeNull();
});
