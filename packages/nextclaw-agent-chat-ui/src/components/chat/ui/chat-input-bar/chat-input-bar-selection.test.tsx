import { deleteChatComposerContent } from './lexical/chat-composer-lexical-adapter';
import { createChatComposerTextNode } from './chat-composer.utils';
import { replaceChatComposerSelectionWithText } from './lexical/chat-composer-lexical-adapter';

describe('ChatInputBar selection behavior', () => {
  it('deletes the whole selected draft instead of only the last character', () => {
    const snapshot = deleteChatComposerContent({
      direction: 'backward',
      nodes: [createChatComposerTextNode('hello world')],
      selection: { start: 0, end: 11 },
    });

    expect(snapshot.nodes).toEqual([
      expect.objectContaining({ type: 'text', text: '' }),
    ]);
    expect(snapshot.selection).toEqual({ start: 0, end: 0 });
  });

  it('deletes a backward selection as a full range', () => {
    const snapshot = deleteChatComposerContent({
      direction: 'backward',
      nodes: [createChatComposerTextNode('hello world')],
      selection: { start: 11, end: 0 },
    });

    expect(snapshot.nodes).toEqual([
      expect.objectContaining({ type: 'text', text: '' }),
    ]);
    expect(snapshot.selection).toEqual({ start: 0, end: 0 });
  });

  it('replaces a backward selection instead of appending text after it', () => {
    const snapshot = replaceChatComposerSelectionWithText({
      nodes: [createChatComposerTextNode('hello world')],
      selection: { start: 11, end: 6 },
      text: 'NextClaw',
    });

    expect(snapshot.nodes).toEqual([
      expect.objectContaining({ type: 'text', text: 'hello NextClaw' }),
    ]);
    expect(snapshot.selection).toEqual({ start: 14, end: 14 });
  });
});
