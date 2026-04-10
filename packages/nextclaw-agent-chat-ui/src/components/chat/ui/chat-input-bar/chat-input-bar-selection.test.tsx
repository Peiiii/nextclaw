import { deleteChatComposerContent } from './lexical/chat-composer-lexical-adapter';
import { createChatComposerTextNode } from './chat-composer.utils';

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
});
