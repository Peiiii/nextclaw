import { createChatComposerTextNode, createChatComposerTokenNode } from '@nextclaw/agent-chat-ui';
import {
  buildInlineTokensFromTextProtocol,
  buildInlineTokensFromComposer,
  CHAT_INLINE_TOKENS_METADATA_KEY,
  readInlineTokensFromMetadata,
  resolveInlineTokensForText,
  resolveWorkspaceReferencePath,
} from '@/features/chat/features/input/utils/chat-inline-token.utils';

describe('chat-inline-token utils', () => {
  it('builds ordered inline skill tokens from composer nodes', () => {
    expect(
      buildInlineTokensFromComposer([
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
        [CHAT_INLINE_TOKENS_METADATA_KEY]: [
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

  it('merges metadata tokens with pure text protocol tokens', () => {
    expect(
      resolveInlineTokensForText('please use $weather and @panel-app:task-board', [
        {
          kind: 'skill',
          key: 'weather',
          label: 'Weather',
          rawText: '$weather'
        }
      ])
    ).toEqual([
      {
        kind: 'skill',
        key: 'weather',
        label: 'Weather',
        rawText: '$weather'
      },
      {
        kind: 'panel_app',
        key: 'task-board',
        label: 'task-board',
        rawText: '@panel-app:task-board'
      }
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

  it('serializes and parses workspace file and directory references', () => {
    expect(
      buildInlineTokensFromComposer([
        createChatComposerTokenNode({
          tokenKind: 'workspace_file',
          tokenKey: 'src/file name.ts',
          label: 'file name.ts',
        }),
        createChatComposerTokenNode({
          tokenKind: 'workspace_directory',
          tokenKey: 'docs/设计',
          label: '设计',
        }),
      ]),
    ).toEqual([
      {
        kind: 'workspace_file',
        key: 'src/file name.ts',
        label: 'file name.ts',
        rawText: '@file:src%2Ffile%20name.ts',
      },
      {
        kind: 'workspace_directory',
        key: 'docs/设计',
        label: '设计',
        rawText: '@folder:docs%2F%E8%AE%BE%E8%AE%A1',
      },
    ]);
    expect(
      buildInlineTokensFromTextProtocol('review @file:src%2Ffile%20name.ts and @folder:docs%2F%E8%AE%BE%E8%AE%A1'),
    ).toEqual([
      {
        kind: 'workspace_file',
        key: 'src/file name.ts',
        label: 'file name.ts',
        rawText: '@file:src%2Ffile%20name.ts',
      },
      {
        kind: 'workspace_directory',
        key: 'docs/设计',
        label: '设计',
        rawText: '@folder:docs%2F%E8%AE%BE%E8%AE%A1',
      },
    ]);
  });

  it('resolves workspace token paths inside POSIX and Windows project roots', () => {
    expect(resolveWorkspaceReferencePath({
      projectRoot: '/tmp/project/',
      relativePath: 'docs/guide.md',
    })).toBe('/tmp/project/docs/guide.md');
    expect(resolveWorkspaceReferencePath({
      projectRoot: 'C:\\workspace\\nextclaw\\',
      relativePath: 'docs/guide.md',
    })).toBe('C:\\workspace\\nextclaw\\docs\\guide.md');
    expect(resolveWorkspaceReferencePath({
      projectRoot: '/tmp/project',
      relativePath: '../secret.txt',
    })).toBeNull();
  });
});
