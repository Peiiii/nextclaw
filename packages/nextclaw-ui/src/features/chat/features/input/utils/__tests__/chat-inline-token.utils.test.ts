import { createChatComposerTextNode, createChatComposerTokenNode } from '@nextclaw/agent-chat-ui';
import {
  buildInlineTokensFromTextProtocol,
  buildInlineTokensFromComposer,
  CHAT_INLINE_TOKENS_METADATA_KEY,
  createInlineTokensMetadata,
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
        createChatComposerTokenNode({
          tokenKind: 'workspace_directory',
          tokenKey: '.',
          label: 'project root',
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
      {
        kind: 'workspace_directory',
        key: '.',
        label: 'project root',
        rawText: '@folder:.',
      },
    ]);
    expect(
      buildInlineTokensFromTextProtocol('review @file:src%2Ffile%20name.ts and @folder:docs%2F%E8%AE%BE%E8%AE%A1 plus @folder:.'),
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
      {
        kind: 'workspace_directory',
        key: '.',
        label: '.',
        rawText: '@folder:.'
      },
    ]);
  });

  it('prefers persisted token metadata over a greedy protocol fallback', () => {
    expect(
      resolveInlineTokensForText(
        '@file:AGENTS.md这里面有啥',
        [
          {
            kind: 'workspace_file',
            key: 'AGENTS.md',
            label: 'AGENTS.md',
            rawText: '@file:AGENTS.md',
          },
        ],
      ),
    ).toEqual([
      {
        kind: 'workspace_file',
        key: 'AGENTS.md',
        label: 'AGENTS.md',
        rawText: '@file:AGENTS.md',
      },
    ]);
  });

  it('serializes project references with their registered path and display name', () => {
    expect(
      buildInlineTokensFromComposer([
        createChatComposerTokenNode({
          tokenKind: 'project',
          tokenKey: '/tmp/NextClaw Project',
          label: 'NextClaw',
        }),
      ]),
    ).toEqual([
      {
        kind: 'project',
        key: '/tmp/NextClaw Project',
        label: 'NextClaw',
        rawText: '@project:%2Ftmp%2FNextClaw%20Project',
      },
    ]);
    expect(
      buildInlineTokensFromTextProtocol('review @project:%2Ftmp%2FNextClaw%20Project'),
    ).toEqual([
      {
        kind: 'project',
        key: '/tmp/NextClaw Project',
        label: 'NextClaw Project',
        rawText: '@project:%2Ftmp%2FNextClaw%20Project',
      },
    ]);
  });

  it('round-trips conversation excerpts with their immutable snapshot', () => {
    const tokens = buildInlineTokensFromComposer([
      createChatComposerTokenNode({
        tokenKind: 'conversation_excerpt',
        tokenKey: 'assistant-1#excerpt-demo',
        label: 'AI reply',
        data: {
          messageId: 'assistant-1',
          role: 'assistant',
          excerpt: 'Keep the visible tag concise.',
        },
      }),
    ]);

    expect(tokens).toEqual([{
      kind: 'conversation_excerpt',
      key: 'assistant-1#excerpt-demo',
      messageId: 'assistant-1',
      role: 'assistant',
      label: 'AI reply',
      excerpt: 'Keep the visible tag concise.',
      rawText: '@message-excerpt:assistant-1%23excerpt-demo',
    }]);
    expect(readInlineTokensFromMetadata({
      ui_inline_tokens: createInlineTokensMetadata(tokens),
    })).toEqual(tokens);
  });

  it('round-trips a visible system object token with its resolved snapshot', () => {
    const reference = {
      uri: 'nextclaw://objects/inbox-delivery/delivery-1',
      objectType: 'inbox-delivery',
      objectId: 'delivery-1',
      label: 'OOM investigation report',
      description: 'Root cause and mitigation',
      updatedAt: '2026-08-11T00:00:00.000Z',
      version: 'sha256-report',
      assetUri: 'asset://store/report',
      fileName: 'oom-investigation-report.md',
      mimeType: 'text/markdown',
      sizeBytes: 128,
    };
    const tokens = buildInlineTokensFromComposer([
      createChatComposerTokenNode({
        tokenKind: 'system_object',
        tokenKey: reference.uri,
        label: reference.label,
        data: { reference },
      }),
    ]);

    expect(tokens).toEqual([{
      kind: 'system_object',
      key: reference.uri,
      label: reference.label,
      rawText: `@object:${encodeURIComponent(reference.uri)}`,
      reference,
    }]);
    expect(readInlineTokensFromMetadata({
      ui_inline_tokens: createInlineTokensMetadata(tokens),
    })).toEqual(tokens);
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

describe('UI resource inline tokens', () => {
  it('round-trips the visible token with its selection-time snapshot', () => {
    const reference = {
      uri: 'nextclaw://apps?tab=panel-apps',
      resourceKind: 'apps',
      title: 'Panel Apps',
      currentUrl: 'nextclaw://apps?tab=panel-apps',
      contentParams: { filter: 'installed' },
    };
    const tokens = buildInlineTokensFromComposer([
      createChatComposerTokenNode({
        tokenKind: 'ui_resource',
        tokenKey: reference.uri,
        label: reference.title,
        data: { reference },
      }),
    ]);

    expect(tokens).toEqual([{
      kind: 'ui_resource',
      key: reference.uri,
      label: reference.title,
      rawText: `@resource:${encodeURIComponent(reference.uri)}`,
      reference,
    }]);
    expect(readInlineTokensFromMetadata({
      ui_inline_tokens: createInlineTokensMetadata(tokens),
    })).toEqual(tokens);
  });
});
