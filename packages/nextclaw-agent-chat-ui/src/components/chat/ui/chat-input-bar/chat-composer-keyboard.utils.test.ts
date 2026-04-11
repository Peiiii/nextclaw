import {
  handleLexicalComposerCompositionEnd,
  resolveLexicalComposerKeyboardAction,
} from './lexical/chat-composer-lexical-controller';
import { createChatComposerTextNode } from './chat-composer.utils';

describe('chat composer keyboard utils', () => {
  it('moves the slash menu selection with arrow keys', () => {
    expect(
      resolveLexicalComposerKeyboardAction({
        key: 'ArrowDown',
        shiftKey: false,
        isComposing: false,
        isSlashMenuOpen: true,
        slashItemCount: 3,
        activeSlashIndex: 1,
        isSending: false,
        canStopGeneration: false
      })
    ).toEqual({
      type: 'move-slash-index',
      index: 2
    });
  });

  it('deletes composer content when backspace is pressed outside IME composition', () => {
    expect(
      resolveLexicalComposerKeyboardAction({
        key: 'Backspace',
        shiftKey: false,
        isComposing: false,
        isSlashMenuOpen: false,
        slashItemCount: 0,
        activeSlashIndex: 0,
        isSending: false,
        canStopGeneration: false
      })
    ).toEqual({
      type: 'delete-content',
      direction: 'backward'
    });
  });

  it('consumes enter while a response is still running', () => {
    expect(
      resolveLexicalComposerKeyboardAction({
        key: 'Enter',
        shiftKey: false,
        isComposing: false,
        isSlashMenuOpen: false,
        slashItemCount: 0,
        activeSlashIndex: 0,
        isSending: true,
        canStopGeneration: true
      })
    ).toEqual({
      type: 'consume'
    });
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
      { forcePublish: true },
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
      { forcePublish: true },
    );
  });
});
