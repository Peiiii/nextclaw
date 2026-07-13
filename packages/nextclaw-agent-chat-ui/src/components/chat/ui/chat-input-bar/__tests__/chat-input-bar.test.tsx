import { useRef, useState, type MutableRefObject } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  ChatInputBar,
  type ChatInputBarHandle,
} from '@agent-chat-ui/components/chat/ui/chat-input-bar/chat-input-bar';
import { resolveInputSurfaceTriggerIdentity } from '@agent-chat-ui/components/chat/ui/input-surface/chat-input-surface-host';
import { createChatComposerTextNode, createChatComposerTokenNode, resolveChatComposerSlashTrigger } from '@agent-chat-ui/components/chat/ui/chat-input-bar/chat-composer.utils';
import { getChatComposerNodesSignature, insertFileTokenIntoChatComposer, insertInputSurfaceItemIntoChatComposer, insertSkillTokenIntoChatComposer } from '@agent-chat-ui/components/chat/ui/chat-input-bar/lexical/chat-composer-lexical-adapter';
import { handleLexicalComposerCompositionEnd } from '@agent-chat-ui/components/chat/ui/chat-input-bar/lexical/chat-composer-lexical-controller';
import type { ChatComposerNode, ChatInputBarProps, ChatToolbarSelect } from '@agent-chat-ui/components/chat/view-models/chat-ui.types';
import {
  DeferredComposerOwnerHarness,
  StreamingComposerHarness,
  type DeferredComposerOwnerHarnessControl,
} from './chat-input-bar-streaming-harness.test-utils';

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
      const event = new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        data: character,
        inputType: 'insertText',
      });
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

it('renders a top slot inside the input bar shell without replacing the composer', () => {
  renderInputBar({
    topSlot: <div data-testid="input-top-slot">Queued input</div>,
  });

  const shell = document.querySelector('.nextclaw-chat-input-bar-shell');
  const topSlot = screen.getByTestId('input-top-slot');
  expect(shell?.contains(topSlot)).toBe(true);
  expect(screen.getByRole('textbox')).toBeTruthy();
});

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

it('treats text node ids as non-semantic for composer document signatures', () => {
  expect(getChatComposerNodesSignature([
    createChatComposerTextNode('你好'),
  ])).toBe(getChatComposerNodesSignature([
    createChatComposerTextNode('你好'),
  ]));
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

it('replaces the current generic trigger query with a panel app token', () => {
  const snapshot = insertInputSurfaceItemIntoChatComposer({
    item: {
      key: 'panel-app:task-board',
      title: 'Task Board',
      subtitle: 'Panel App',
      description: 'Tasks',
      detailLines: [],
      tokenKind: 'panel_app',
      tokenKey: 'task-board',
      value: 'task-board',
    },
    nodes: [createChatComposerTextNode('@task')],
    selection: { start: 5, end: 5 },
    triggerSpecs: [{ key: 'panel-app-reference', marker: '@' }],
  });

  expect(snapshot.nodes).toEqual([
    expect.objectContaining({
      type: 'token',
      tokenKind: 'panel_app',
      tokenKey: 'task-board',
      label: 'Task Board',
    }),
  ]);
  expect(snapshot.selection).toEqual({ start: 1, end: 1 });
});

it('clears the current trigger query for a command item without inserting a token', () => {
  const snapshot = insertInputSurfaceItemIntoChatComposer({
    item: {
      key: 'command:side-chat',
      title: 'Side chat',
      subtitle: 'Command',
      description: 'Open side chat',
      detailLines: [],
    },
    nodes: [createChatComposerTextNode('/side')],
    selection: { start: 5, end: 5 },
    triggerSpecs: [{ key: 'slash', marker: '/' }],
  });

  expect(snapshot.nodes).toEqual([
    expect.objectContaining({
      type: 'text',
      text: '',
    }),
  ]);
  expect(snapshot.selection).toEqual({ start: 0, end: 0 });
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

it('creates an input surface instance only from an inserted slash marker', () => {
  const slashTrigger = {
    key: 'slash',
    marker: '/',
    query: '',
    start: 0,
    end: 1,
  };
  const queriedTrigger = {
    ...slashTrigger,
    query: 'xx',
    end: 3,
  };
  const activeIdentity = resolveInputSurfaceTriggerIdentity(null, slashTrigger, {
    type: 'insert-text',
    text: '/',
  });

  expect(activeIdentity).toBe('slash:/:0');
  expect(
    resolveInputSurfaceTriggerIdentity(activeIdentity, queriedTrigger, {
      type: 'insert-text',
      text: 'x',
    }),
  ).toBe(activeIdentity);
  expect(
    resolveInputSurfaceTriggerIdentity(activeIdentity, null, {
      type: 'insert-text',
      text: ' ',
    }),
  ).toBeNull();
  expect(
    resolveInputSurfaceTriggerIdentity(null, queriedTrigger, {
      type: 'delete-content',
    }),
  ).toBeNull();
  expect(
    resolveInputSurfaceTriggerIdentity(null, queriedTrigger, {
      type: 'sync',
    }),
  ).toBeNull();
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

it('keeps local IME typing stable across stale owner rerenders before the owner flushes nodes', async () => {
  const controlRef: MutableRefObject<DeferredComposerOwnerHarnessControl | null> = { current: null };
  render(<DeferredComposerOwnerHarness controlRef={controlRef} />);

  const textbox = screen.getByRole('textbox');
  fireEvent.focus(textbox);
  fireEvent.compositionStart(textbox);
  fireEvent.compositionEnd(textbox, { data: '你' });

  await waitFor(() => expect(textbox.textContent).toBe('你'));

  act(() => {
    controlRef.current?.bumpStream();
  });
  fireEvent.compositionStart(textbox);
  fireEvent.compositionEnd(textbox, { data: '好' });

  await waitFor(() => expect(textbox.textContent).toBe('你好'));

  act(() => {
    controlRef.current?.flushNodes();
  });

  await waitFor(() => expect(textbox.textContent).toBe('你好'));
});

it('keeps the caret at the end while stale owner rerenders during local typing', async () => {
  const controlRef: MutableRefObject<DeferredComposerOwnerHarnessControl | null> = { current: null };
  render(<DeferredComposerOwnerHarness controlRef={controlRef} />);

  const textbox = screen.getByRole('textbox');
  fireEvent.focus(textbox);
  fireEvent.compositionStart(textbox);
  fireEvent.compositionEnd(textbox, { data: '你' });

  await waitFor(() => expect(textbox.textContent).toBe('你'));

  act(() => {
    controlRef.current?.bumpStream();
  });

  fireEvent.compositionStart(textbox);
  fireEvent.compositionEnd(textbox, { data: '好' });

  await waitFor(() => expect(textbox.textContent).toBe('你好'));
  await waitFor(() => {
    const selection = window.getSelection();
    expect(selection?.anchorOffset).toBe(2);
    expect(selection?.focusOffset).toBe(2);
  });
});

it('does not duplicate IME text already committed by the browser before compositionend', () => {
  const startSnapshot = {
    nodes: [createChatComposerTextNode('')],
    selection: { start: 0, end: 0 },
  };
  const committedSnapshot = {
    nodes: [createChatComposerTextNode('你好')],
    selection: { start: 2, end: 2 },
  };
  const publishSnapshot = vi.fn();

  handleLexicalComposerCompositionEnd({
    compositionStartSnapshot: startSnapshot,
    data: '你好',
    fallbackSnapshot: () => committedSnapshot,
    publishSnapshot,
    snapshotReader: () => committedSnapshot,
  });

  expect(publishSnapshot).toHaveBeenCalledWith(
    expect.objectContaining({
      nodes: [expect.objectContaining({ text: '你好', type: 'text' })],
      selection: { start: 2, end: 2 },
    }),
    expect.any(Object),
  );
});

it('keeps IME composition stable while streamed output rerenders the parent', async () => {
  const controlRef: MutableRefObject<{ bumpStream: () => void } | null> = { current: null };
  render(<StreamingComposerHarness controlRef={controlRef} />);

  const textbox = screen.getByRole('textbox');
  fireEvent.focus(textbox);
  fireEvent.compositionStart(textbox);

  act(() => {
    controlRef.current?.bumpStream();
    controlRef.current?.bumpStream();
  });
  expect(screen.getByTestId('stream-chunk').textContent).toBe('2');

  fireEvent.compositionEnd(textbox, { data: '你' });

  await waitFor(() => expect(textbox.textContent).toBe('你'));
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

  expect(screen.getByTestId('chat-stop-icon').className).toContain('bg-foreground');
  fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
  expect(onStop).toHaveBeenCalled();
});

it('keeps the send control active during streaming when the draft can be queued', () => {
  const onSend = vi.fn();
  const onStop = vi.fn();
  renderInputBar({
    toolbar: {
      actions: {
        isSending: true,
        canStopGeneration: true,
        sendDisabled: false,
        sendButtonLabel: 'Queue',
        stopDisabled: false,
        onSend,
        onStop
      }
    }
  });

  fireEvent.click(screen.getByRole('button', { name: 'Queue' }));

  expect(onSend).toHaveBeenCalled();
  expect(onStop).not.toHaveBeenCalled();
  expect(screen.queryByTestId('chat-stop-icon')).toBeNull();
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
  expect(modelTrigger.className).toContain('min-w-0');
  expect(modelTrigger.className).toContain('max-w-[18rem]');
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
    sendError: longError,
    sendErrorDetailsLabel: 'View details',
  });

  const sendErrorStatus = screen.getByRole('status');
  const sendButton = screen.getByRole('button', { name: 'Send' });
  expect(sendErrorStatus.compareDocumentPosition(sendButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
    sendError: hoverError,
    sendErrorDetailsLabel: 'View details',
  });

  expect(screen.getByRole('button', { name: 'View details' })).toBeTruthy();
  expect(
    screen.getByRole('status').querySelector('span[title]')?.getAttribute('title')
  ).toBe(hoverError);
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
  expect(indicator.querySelector('span')?.getAttribute('style')).toContain('hsl(var(--muted-foreground))');
  expect(screen.queryByText('38%')).toBeNull();
});
