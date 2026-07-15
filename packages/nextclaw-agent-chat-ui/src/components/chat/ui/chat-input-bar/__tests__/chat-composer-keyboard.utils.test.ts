import {
  handleLexicalComposerKeyboardCommand,
  resolveLexicalComposerKeyboardAction,
} from '@agent-chat-ui/components/chat/ui/chat-input-bar/lexical/chat-composer-lexical-controller';

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

  it('leaves backspace deletion to Lexical outside IME composition', () => {
    expect(
      resolveLexicalComposerKeyboardAction({
        key: 'Backspace',
        shiftKey: false,
        isComposing: false,
        isSending: false,
        canStopGeneration: false
      }),
    ).toEqual({ type: 'noop' });
  });

  it('leaves candidate confirmation keys to the active IME composition', () => {
    expect(
      resolveLexicalComposerKeyboardAction({
        key: 'Enter',
        shiftKey: false,
        isComposing: true,
        isSending: false,
        canStopGeneration: false,
      }),
    ).toEqual({ type: 'noop' });
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
    const nativeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    const preventDefault = vi.spyOn(nativeEvent, 'preventDefault');

    const handled = handleLexicalComposerKeyboardCommand({
      actions: {
        canStopGeneration: false,
        isSending: false,
        onSend: vi.fn(),
        onStop: vi.fn(),
      },
      isComposing: false,
      nativeEvent,
    });

    expect(handled).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();
  });

});
