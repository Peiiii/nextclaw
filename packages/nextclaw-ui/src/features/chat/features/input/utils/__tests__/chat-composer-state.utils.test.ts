import { createChatComposerTextNode, createChatComposerTokenNode } from '@nextclaw/agent-chat-ui';
import { deriveNcpMessagePartsFromComposer } from '@/features/chat/features/input/utils/chat-composer-state.utils';

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
            tokenKey: 'workspace:/tmp/workspace/skills/web-search',
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
        text: ' between $Web Searchafter'
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

  it('serializes panel app tokens as inline panel app references', () => {
    expect(
      deriveNcpMessagePartsFromComposer(
        [
          createChatComposerTextNode('review '),
          createChatComposerTokenNode({
            tokenKind: 'panel_app',
            tokenKey: 'task-board',
            label: 'Task Board'
          })
        ],
        []
      )
    ).toEqual([
      {
        type: 'text',
        text: 'review @panel-app:task-board'
      }
    ]);
  });

  it('serializes workspace references without turning them into uploaded file parts', () => {
    expect(
      deriveNcpMessagePartsFromComposer(
        [
          createChatComposerTokenNode({
            tokenKind: 'workspace_file',
            tokenKey: 'src/file name.ts',
            label: 'file name.ts',
          }),
          createChatComposerTextNode(' and '),
          createChatComposerTokenNode({
            tokenKind: 'workspace_directory',
            tokenKey: 'docs/设计',
            label: '设计',
          }),
        ],
        [],
      ),
    ).toEqual([
      {
        type: 'text',
        text: '@file:src%2Ffile%20name.ts and @folder:docs%2F%E8%AE%BE%E8%AE%A1',
      },
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
