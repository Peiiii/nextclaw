import { describe, expect, it, vi } from 'vitest';
import { ChatComposerIntentManager } from '@/features/chat/managers/chat-composer-intent.manager';

describe('ChatComposerIntentManager', () => {
  it('delivers a file reference only to the targeted composer', () => {
    const manager = new ChatComposerIntentManager();
    const draftListener = vi.fn();
    const sessionListener = vi.fn();
    manager.subscribe(null, draftListener);
    manager.subscribe('session-1', sessionListener);

    manager.requestFileReference({
      targetSessionKey: null,
      tokenKey: 'docs/guide.md',
      label: 'guide.md',
    });

    expect(draftListener).toHaveBeenCalledWith(
      expect.objectContaining({
        targetSessionKey: null,
        tokenKey: 'docs/guide.md',
        label: 'guide.md',
      }),
    );
    expect(sessionListener).not.toHaveBeenCalled();
  });

  it('keeps an intent pending until its matching composer mounts', () => {
    const manager = new ChatComposerIntentManager();
    manager.requestFileReference({
      targetSessionKey: ' session-1 ',
      tokenKey: ' src/index.ts ',
      label: ' index.ts ',
    });

    expect(manager.consumePending(null)).toBeNull();
    expect(manager.consumePending('session-1')).toMatchObject({
      targetSessionKey: 'session-1',
      tokenKey: 'src/index.ts',
      label: 'index.ts',
    });
    expect(manager.consumePending('session-1')).toBeNull();
  });

  it('publishes a directory reference with the workspace directory kind', () => {
    const manager = new ChatComposerIntentManager();
    const listener = vi.fn();
    manager.subscribe('session-1', listener);

    manager.requestDirectoryReference({
      targetSessionKey: 'session-1',
      tokenKey: 'docs/designs',
      label: 'designs',
    });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'workspace_directory',
        tokenKey: 'docs/designs',
        label: 'designs',
      }),
    );
  });

  it('ignores incomplete file references', () => {
    const manager = new ChatComposerIntentManager();
    const listener = vi.fn();
    manager.subscribe(null, listener);

    manager.requestFileReference({
      targetSessionKey: null,
      tokenKey: ' ',
      label: 'README.md',
    });

    expect(listener).not.toHaveBeenCalled();
    expect(manager.consumePending(null)).toBeNull();
  });

  it('publishes a source-aware excerpt with a stable content identity', () => {
    const manager = new ChatComposerIntentManager();
    const listener = vi.fn();
    manager.subscribe('session-1', listener);

    manager.requestExcerptReference({
      targetSessionKey: 'session-1',
      path: 'docs/guide.md',
      label: 'guide.md',
      excerpt: 'selected text',
      startLine: 12,
      endLine: 13,
    });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'workspace_excerpt',
        path: 'docs/guide.md',
        label: 'guide.md',
        excerpt: 'selected text',
        startLine: 12,
        endLine: 13,
        tokenKey: expect.stringMatching(/^docs\/guide\.md#excerpt-/),
      }),
    );
  });

  it('delivers an excerpt to the unmaterialized new-chat composer', () => {
    const manager = new ChatComposerIntentManager();
    const draftListener = vi.fn();
    manager.subscribe(null, draftListener);

    manager.requestExcerptReference({
      targetSessionKey: null,
      path: 'package.json',
      label: 'package.json',
      excerpt: '"name": "nextclaw"',
      startLine: 2,
      endLine: 2,
    });

    expect(draftListener).toHaveBeenCalledWith(
      expect.objectContaining({
        targetSessionKey: null,
        kind: 'workspace_excerpt',
        path: 'package.json',
        excerpt: '"name": "nextclaw"',
      }),
    );
  });

  it('publishes a conversation excerpt with its source message identity', () => {
    const manager = new ChatComposerIntentManager();
    const listener = vi.fn();
    manager.subscribe('session-1', listener);

    manager.requestConversationExcerptReference({
      targetSessionKey: 'session-1',
      messageId: 'assistant-message-1',
      role: 'assistant',
      label: 'AI reply',
      excerpt: 'Keep the visible tag concise.',
    });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'conversation_excerpt',
        messageId: 'assistant-message-1',
        role: 'assistant',
        label: 'AI reply',
        excerpt: 'Keep the visible tag concise.',
        tokenKey: expect.stringMatching(/^assistant-message-1#excerpt-/),
      }),
    );
  });

  it('publishes an immutable UI resource reference to the targeted composer', () => {
    const manager = new ChatComposerIntentManager();
    const listener = vi.fn();
    manager.subscribe('session-1', listener);
    const reference = {
      uri: 'nextclaw://panel-app/task-board',
      resourceKind: 'panel-app',
      title: 'Task board',
      currentUrl: '/api/panel-apps/task-board/content',
      contentParams: { boardId: 'today' },
    };

    manager.requestUiResourceReference({
      targetSessionKey: 'session-1',
      reference,
    });
    reference.contentParams.boardId = 'mutated';

    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'ui_resource',
      targetSessionKey: 'session-1',
      tokenKey: 'nextclaw://panel-app/task-board',
      label: 'Task board',
      reference: expect.objectContaining({
        contentParams: { boardId: 'today' },
      }),
    }));
  });
});
