import { describe, expect, it } from 'vitest';
import { createChatComposerTextNode } from '@agent-chat-ui/components/chat/ui/chat-input-bar/chat-composer.utils';
import { insertInputSurfaceItemIntoChatComposer } from '@agent-chat-ui/components/chat/ui/chat-input-bar/lexical/chat-composer-lexical-adapter';

describe('chat input bar context references', () => {
  it('replaces an @ query with a workspace file token', () => {
    const snapshot = insertInputSurfaceItemIntoChatComposer({
      item: {
        key: 'workspace:file:src/server.ts',
        title: 'server.ts',
        subtitle: 'src',
        description: 'Project file',
        detailLines: [],
        tokenKind: 'workspace_file',
        tokenKey: 'src/server.ts',
      },
      nodes: [createChatComposerTextNode('@server')],
      selection: { start: 7, end: 7 },
      triggerSpecs: [{ key: 'context-reference', marker: '@' }],
    });

    expect(snapshot.nodes).toEqual([
      expect.objectContaining({
        type: 'token',
        tokenKind: 'workspace_file',
        tokenKey: 'src/server.ts',
        label: 'server.ts',
      }),
    ]);
  });

  it('replaces an @ query with a project token', () => {
    const snapshot = insertInputSurfaceItemIntoChatComposer({
      item: {
        key: 'project:/tmp/nextclaw',
        title: 'NextClaw',
        subtitle: 'Project',
        description: 'Registered project',
        detailLines: ['/tmp/nextclaw'],
        tokenKind: 'project',
        tokenKey: '/tmp/nextclaw',
      },
      nodes: [createChatComposerTextNode('@next')],
      selection: { start: 5, end: 5 },
      triggerSpecs: [{ key: 'context-reference', marker: '@' }],
    });

    expect(snapshot.nodes).toEqual([
      expect.objectContaining({
        type: 'token',
        tokenKind: 'project',
        tokenKey: '/tmp/nextclaw',
        label: 'NextClaw',
      }),
    ]);
  });
});
