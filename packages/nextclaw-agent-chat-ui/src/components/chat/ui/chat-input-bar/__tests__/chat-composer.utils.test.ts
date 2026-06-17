import {
  createChatComposerTextNode,
  createChatComposerTokenNode,
  extractChatComposerTokenKeys,
  replaceChatComposerRange,
  resolveChatComposerSlashTrigger,
  serializeChatComposerPlainText
} from '@agent-chat-ui/components/chat/ui/chat-input-bar/chat-composer.utils';

describe('chat composer utils', () => {
  it('keeps an existing token when inserting text at the token boundary', () => {
    const nodes = [
      createChatComposerTokenNode({ tokenKind: 'skill', tokenKey: 'web-search', label: 'Web Search' })
    ];

    const nextNodes = replaceChatComposerRange(
      nodes,
      1,
      1,
      [createChatComposerTextNode(' hello')]
    );

    expect(nextNodes).toEqual([
      expect.objectContaining({ type: 'token', tokenKey: 'web-search' }),
      expect.objectContaining({ type: 'text', text: ' hello' })
    ]);
  });

  it('replaces a slash query with a skill token while preserving surrounding text', () => {
    const nodes = [
      createChatComposerTextNode('hello /web'),
      createChatComposerTextNode(' world')
    ];

    const nextNodes = replaceChatComposerRange(
      nodes,
      6,
      10,
      [createChatComposerTokenNode({ tokenKind: 'skill', tokenKey: 'web-search', label: 'Web Search' })]
    );

    expect(serializeChatComposerPlainText(nextNodes)).toBe('hello  world');
    expect(extractChatComposerTokenKeys(nextNodes, 'skill')).toEqual(['web-search']);
  });

  it('resolves a slash trigger at the current caret position', () => {
    const nodes = [
      createChatComposerTextNode('please use /web')
    ];

    expect(resolveChatComposerSlashTrigger(nodes, { start: 15, end: 15 })).toEqual({
      query: 'web',
      start: 11,
      end: 15
    });
  });
});
