import { createChatComposerTextNode, createChatComposerTokenNode } from '@nextclaw/agent-chat-ui';
import {
  buildInlineTokensFromTextProtocol,
  buildInlineSkillTokensFromComposer,
  CHAT_UI_INLINE_TOKENS_METADATA_KEY,
  readInlineTokensFromMetadata,
  splitTextByInlineTokens
} from '@/features/chat/features/input/utils/chat-inline-token.utils';

describe('chat-inline-token utils', () => {
  it('builds ordered inline skill tokens from composer nodes', () => {
    expect(
      buildInlineSkillTokensFromComposer([
        createChatComposerTextNode('before '),
        createChatComposerTokenNode({
          tokenKind: 'skill',
          tokenKey: 'weather',
          label: 'Weather'
        }),
        createChatComposerTokenNode({
          tokenKind: 'skill',
          tokenKey: 'docs',
          label: 'Docs'
        })
      ])
    ).toEqual([
      {
        kind: 'skill',
        key: 'weather',
        label: 'Weather',
        rawText: '$weather'
      },
      {
        kind: 'skill',
        key: 'docs',
        label: 'Docs',
        rawText: '$docs'
      }
    ]);
  });

  it('reads generic inline token metadata safely', () => {
    expect(
      readInlineTokensFromMetadata({
        [CHAT_UI_INLINE_TOKENS_METADATA_KEY]: [
          {
            kind: 'skill',
            key: 'weather',
            label: 'Weather',
            rawText: '$weather'
          }
        ]
      })
    ).toEqual([
      {
        kind: 'skill',
        key: 'weather',
        label: 'Weather',
        rawText: '$weather'
      }
    ]);
  });

  it('splits text into inline text and token fragments', () => {
    expect(
      splitTextByInlineTokens('please use $weather now', [
        {
          kind: 'skill',
          key: 'weather',
          label: 'Weather',
          rawText: '$weather'
        }
      ])
    ).toEqual([
      { type: 'text', text: 'please use ' },
      {
        type: 'token',
        token: {
          kind: 'skill',
          key: 'weather',
          label: 'Weather',
          rawText: '$weather'
        }
      },
      { type: 'text', text: ' now' }
    ]);
  });

  it('builds inline panel app tokens from pure text protocol', () => {
    expect(buildInlineTokensFromTextProtocol('review @panel-app:task-board now')).toEqual([
      {
        kind: 'panel_app',
        key: 'task-board',
        label: 'task-board',
        rawText: '@panel-app:task-board'
      }
    ]);
  });
});
