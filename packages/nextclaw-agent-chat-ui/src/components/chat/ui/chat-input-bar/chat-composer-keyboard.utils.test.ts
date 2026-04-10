import { resolveLexicalComposerKeyboardAction } from './lexical/chat-composer-lexical-controller';

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
});
