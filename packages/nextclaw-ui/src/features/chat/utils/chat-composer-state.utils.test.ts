import { createChatComposerTextNode, createChatComposerTokenNode } from '@nextclaw/agent-chat-ui';
import { deriveNcpMessagePartsFromComposer } from './chat-composer-state.utils';

describe('deriveNcpMessagePartsFromComposer', () => {
  it('preserves interleaved text and image token order while serializing skill tokens inline', () => {
    const parts = deriveNcpMessagePartsFromComposer(
      [
        createChatComposerTextNode('before '),
        createChatComposerTokenNode({
          tokenKind: 'file',
          tokenKey: 'image-1',
          label: 'one.png'
        }),
        createChatComposerTextNode(' between '),
        createChatComposerTokenNode({
          tokenKind: 'skill',
          tokenKey: 'web-search',
          label: 'Web Search'
        }),
        createChatComposerTextNode('after'),
        createChatComposerTokenNode({
          tokenKind: 'file',
          tokenKey: 'image-2',
          label: 'two.png'
        })
      ],
      [
        {
          id: 'image-1',
          name: 'one.png',
          mimeType: 'image/png',
          contentBase64: 'aW1hZ2UtMQ==',
          sizeBytes: 10
        },
        {
          id: 'image-2',
          name: 'two.png',
          mimeType: 'image/png',
          contentBase64: 'aW1hZ2UtMg==',
          sizeBytes: 12
        }
      ]
    );

    expect(parts).toEqual([
      {
        type: 'text',
        text: 'before '
      },
      {
        type: 'file',
        name: 'one.png',
        mimeType: 'image/png',
        contentBase64: 'aW1hZ2UtMQ==',
        sizeBytes: 10
      },
      {
        type: 'text',
        text: ' between $web-searchafter'
      },
      {
        type: 'file',
        name: 'two.png',
        mimeType: 'image/png',
        contentBase64: 'aW1hZ2UtMg==',
        sizeBytes: 12
      }
    ]);
  });

  it('preserves uploaded attachment references when the attachment has a server uri', () => {
    const parts = deriveNcpMessagePartsFromComposer(
      [
        createChatComposerTokenNode({
          tokenKind: 'file',
          tokenKey: 'config',
          label: 'config.json'
        })
      ],
      [
        {
          id: 'config',
          name: 'config.json',
          mimeType: 'application/json',
          sizeBytes: 18,
          assetUri: 'asset://store/2026/03/26/asset_123',
          url: '/api/ncp/assets/content?uri=asset%3A%2F%2Fstore%2F2026%2F03%2F26%2Fasset_123'
        }
      ]
    );

    expect(parts).toEqual([
      {
        type: 'file',
        name: 'config.json',
        mimeType: 'application/json',
        assetUri: 'asset://store/2026/03/26/asset_123',
        url: '/api/ncp/assets/content?uri=asset%3A%2F%2Fstore%2F2026%2F03%2F26%2Fasset_123',
        sizeBytes: 18
      }
    ]);
  });
});
