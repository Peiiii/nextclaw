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
      buildInlineTokensFromComposer(
        [
          createChatComposerTextNode('before '),
          createChatComposerTokenNode({
            tokenKind: 'skill',
            tokenKey: 'workspace:/skills/weather',
            label: 'weather'
          }),
          createChatComposerTokenNode({
            tokenKind: 'skill',
            tokenKey: 'global:/skills/docs',
            label: 'docs'
          })
        ],
        [
          {
            ref: 'workspace:/skills/weather',
            name: 'weather',
            source: 'workspace',
            path: '/skills/weather/SKILL.md',
          },
          {
            ref: 'global:/skills/docs',
            name: 'docs',
            source: 'global',
            path: '/skills/docs/SKILL.md',
          },
        ],
      )
    ).toEqual([
      {
        kind: 'skill',
        ref: 'workspace:/skills/weather',
        name: 'weather',
        source: 'workspace',
        path: '/skills/weather/SKILL.md',
        label: 'weather',
        rawText: '$weather'
      },
      {
        kind: 'skill',
        ref: 'global:/skills/docs',
        name: 'docs',
        source: 'global',
        path: '/skills/docs/SKILL.md',
        label: 'docs',
        rawText: '$docs'
      }
    ]);
  });

  it('reads versioned inline skill metadata without parsing its ref', () => {
    expect(
      readInlineTokensFromMetadata({
        [CHAT_INLINE_TOKENS_METADATA_KEY]: {
          schemaVersion: 2,
          items: [
            {
              kind: 'skill',
              ref: 'workspace:/skills/weather',
              name: 'weather',
              source: 'workspace',
              path: '/skills/weather/SKILL.md',
              label: 'weather',
              rawText: '$weather'
            }
          ]
        }
      })
    ).toEqual([
      {
        kind: 'skill',
        ref: 'workspace:/skills/weather',
        name: 'weather',
        source: 'workspace',
        path: '/skills/weather/SKILL.md',
        label: 'weather',
        rawText: '$weather'
      }
    ]);
  });

  it('normalizes persisted v1 skill keys only at the metadata boundary', () => {
    expect(readInlineTokensFromMetadata({
      [CHAT_INLINE_TOKENS_METADATA_KEY]: [
        {
          kind: 'skill',
          key: 'workspace:/skills/weather',
          label: 'weather',
          rawText: '$workspace:/skills/weather',
        },
      ],
    })).toEqual([
      {
        kind: 'skill',
        ref: 'workspace:/skills/weather',
        name: 'weather',
        source: null,
        path: null,
        label: 'weather',
        rawText: '$workspace:/skills/weather',
      },
    ]);
  });

  it('preserves every skill source as an explicit field', () => {
    const sources = ['builtin', 'global', 'project', 'workspace'] as const;
    const tokens = buildInlineTokensFromComposer(
      sources.map((source) => createChatComposerTokenNode({
        tokenKind: 'skill',
        tokenKey: `${source}:/skills/${source}`,
        label: source,
      })),
      sources.map((source) => ({
        ref: `${source}:/skills/${source}`,
        name: source,
        source,
        path: `/skills/${source}/SKILL.md`,
      })),
    );

    expect(tokens.map((token) => token.kind === 'skill' ? token.source : null)).toEqual(sources);
  });

  it('merges metadata tokens with pure text protocol tokens', () => {
    expect(
      resolveInlineTokensForText('please use $weather and @panel-app:task-board', [
        {
          kind: 'skill',
          ref: 'workspace:/skills/weather',
          name: 'weather',
          source: 'workspace',
          path: '/skills/weather/SKILL.md',
          label: 'weather',
          rawText: '$weather'
        }
      ])
    ).toEqual([
      {
        kind: 'skill',
        ref: 'workspace:/skills/weather',
        name: 'weather',
        source: 'workspace',
        path: '/skills/weather/SKILL.md',
        label: 'weather',
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
});

describe('chat inline token workspace references', () => {
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
