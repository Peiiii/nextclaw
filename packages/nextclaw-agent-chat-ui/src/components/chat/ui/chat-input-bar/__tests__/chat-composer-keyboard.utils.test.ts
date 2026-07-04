import {
  handleLexicalComposerCompositionEnd,
  handleLexicalComposerKeyboardCommand,
  resolveLexicalComposerKeyboardAction,
} from '@agent-chat-ui/components/chat/ui/chat-input-bar/lexical/chat-composer-lexical-controller';
import { createChatComposerTextNode } from '@agent-chat-ui/components/chat/ui/chat-input-bar/chat-composer.utils';

describe('chat composer keyboard utils', () => {
  it('leaves popup navigation keys to the input surface host', () => {
    expect(
      resolveLexicalComposerKeyboardAction({
        key: 'ArrowDown',
        shiftKey: false,
        isComposing: false,
        isSending: false,
        canStopGeneration: false
      }),
    ).toEqual({ type: 'noop' });
  });

  it('deletes composer content when backspace is pressed outside IME composition', () => {
    expect(
      resolveLexicalComposerKeyboardAction({
        key: 'Backspace',
        shiftKey: false,
        isComposing: false,
        isSending: false,
        canStopGeneration: false
      }),
    ).toEqual({
      type: 'delete-content',
      direction: 'backward'
    });
  });

  it('routes enter to send while a response is still running', () => {
    expect(
      resolveLexicalComposerKeyboardAction({
        key: 'Enter',
        shiftKey: false,
        isComposing: false,
        isSending: true,
        canStopGeneration: true
      }),
    ).toEqual({
      type: 'send-message'
    });
  });

  it('does not handle Escape when no response stop action is available', () => {
    const publishSnapshot = vi.fn();
    const nativeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    const preventDefault = vi.spyOn(nativeEvent, 'preventDefault');

    const handled = handleLexicalComposerKeyboardCommand({
      actions: {
        canStopGeneration: false,
        isSending: false,
        onSend: vi.fn(),
        onStop: vi.fn(),
      },
      nativeEvent,
      publishSnapshot,
      snapshot: {
        nodes: [createChatComposerTextNode('/')],
        selection: { start: 1, end: 1 },
      },
    });

    expect(handled).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(publishSnapshot).not.toHaveBeenCalled();
  });

  it('prefers the editor snapshot when composition already updated the document', () => {
    const publishSnapshot = vi.fn();
    const snapshotReader = vi.fn(() => ({
      nodes: [createChatComposerTextNode('ab')],
      selection: { start: 1, end: 1 },
    }));
    const fallbackSnapshot = vi.fn(() => ({
      nodes: [createChatComposerTextNode('a你b')],
      selection: { start: 2, end: 2 },
    }));

    handleLexicalComposerCompositionEnd({
      data: '你',
      fallbackSnapshot,
      publishSnapshot,
      snapshotReader,
    });

    expect(publishSnapshot).toHaveBeenCalledWith(
      {
        nodes: [expect.objectContaining({ type: 'text', text: 'a你b' })],
        selection: { start: 2, end: 2 },
      },
      { forcePublish: true, inputSurfaceReason: { type: 'insert-text', text: '你' } },
    );
  });

  it('keeps the slash marker before manually committed IME text', () => {
    const publishSnapshot = vi.fn();
    const snapshotReader = vi.fn(() => ({
      nodes: [createChatComposerTextNode('/')],
      selection: { start: 1, end: 1 },
    }));
    const fallbackSnapshot = vi.fn(() => ({
      nodes: [createChatComposerTextNode('/')],
      selection: { start: 1, end: 1 },
    }));

    handleLexicalComposerCompositionEnd({
      data: '你',
      fallbackSnapshot,
      publishSnapshot,
      snapshotReader,
    });

    expect(publishSnapshot).toHaveBeenCalledWith(
      {
        nodes: [expect.objectContaining({ type: 'text', text: '/你' })],
        selection: { start: 2, end: 2 },
      },
      { forcePublish: true, inputSurfaceReason: { type: 'insert-text', text: '你' } },
    );
  });

  it('falls back to manual insertion when the editor snapshot has not updated yet', () => {
    const publishSnapshot = vi.fn();
    const snapshotReader = vi.fn(() => ({
      nodes: [createChatComposerTextNode('ab')],
      selection: { start: 1, end: 1 },
    }));
    const fallbackSnapshot = vi.fn(() => ({
      nodes: [createChatComposerTextNode('ab')],
      selection: { start: 1, end: 1 },
    }));

    handleLexicalComposerCompositionEnd({
      data: '你',
      fallbackSnapshot,
      publishSnapshot,
      snapshotReader,
    });

    expect(publishSnapshot).toHaveBeenCalledWith(
      {
        nodes: [expect.objectContaining({ type: 'text', text: 'a你b' })],
        selection: { start: 2, end: 2 },
      },
      { forcePublish: true, inputSurfaceReason: { type: 'insert-text', text: '你' } },
    );
  });
});
