import { describe, expect, it } from 'vitest';
import type { SessionEntryView, ThinkingLevel } from '@/api/types';
import {
  resolveRecentSessionPreferredModel,
  resolveRecentSessionPreferredThinking,
  resolveSelectedModelValue,
  resolveSelectedThinkingLevelValue
} from '@/components/chat/chat-session-preference-governance';
import {
  shouldClearPendingProjectRootOverride
} from '@/components/chat/ncp/ncp-chat-page';

const modelOptions = [
  {
    value: 'anthropic/claude-sonnet-4',
    modelLabel: 'claude-sonnet-4',
    providerLabel: 'Anthropic',
    thinkingCapability: null
  },
  {
    value: 'openai/gpt-5',
    modelLabel: 'gpt-5',
    providerLabel: 'OpenAI',
    thinkingCapability: null
  }
];

function createSession(overrides: Partial<SessionEntryView> & Pick<SessionEntryView, 'key'>): SessionEntryView {
  return {
    key: overrides.key,
    createdAt: overrides.createdAt ?? '2026-03-19T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-03-19T00:00:00.000Z',
    sessionType: overrides.sessionType ?? 'native',
    sessionTypeMutable: overrides.sessionTypeMutable ?? false,
    isChildSession: overrides.isChildSession ?? false,
    messageCount: overrides.messageCount ?? 0,
    ...(overrides.label ? { label: overrides.label } : {}),
    ...(overrides.preferredModel ? { preferredModel: overrides.preferredModel } : {}),
    ...(Object.prototype.hasOwnProperty.call(overrides, 'preferredThinking')
      ? { preferredThinking: overrides.preferredThinking ?? null }
      : {}),
    ...(overrides.lastRole ? { lastRole: overrides.lastRole } : {}),
    ...(overrides.lastTimestamp ? { lastTimestamp: overrides.lastTimestamp } : {})
  };
}

const thinkingLevels: ThinkingLevel[] = ['off', 'minimal', 'medium', 'high'];

describe('resolveSelectedModelValue', () => {
  it('keeps the current selected model when it is still available', () => {
    expect(
      resolveSelectedModelValue({
        currentSelectedModel: 'openai/gpt-5',
        modelOptions,
        selectedSessionPreferredModel: 'anthropic/claude-sonnet-4',
        fallbackPreferredModel: 'anthropic/claude-sonnet-4',
        defaultModel: 'anthropic/claude-sonnet-4'
      })
    ).toBe('openai/gpt-5');
  });

  it('prefers the current session preferred model over runtime fallback and global default', () => {
    expect(
      resolveSelectedModelValue({
        currentSelectedModel: 'missing/model',
        modelOptions,
        selectedSessionPreferredModel: 'openai/gpt-5',
        fallbackPreferredModel: 'anthropic/claude-sonnet-4',
        defaultModel: 'anthropic/claude-sonnet-4'
      })
    ).toBe('openai/gpt-5');
  });

  it('prefers the current session preferred model over a stale in-memory selection after switching sessions', () => {
    expect(
      resolveSelectedModelValue({
        currentSelectedModel: 'anthropic/claude-sonnet-4',
        modelOptions,
        selectedSessionPreferredModel: 'openai/gpt-5',
        fallbackPreferredModel: 'anthropic/claude-sonnet-4',
        defaultModel: 'anthropic/claude-sonnet-4',
        preferSessionPreferredModel: true
      })
    ).toBe('openai/gpt-5');
  });

  it('ignores the stale in-memory selection when a switched session has no explicit preferred model', () => {
    expect(
      resolveSelectedModelValue({
        currentSelectedModel: 'anthropic/claude-sonnet-4',
        modelOptions,
        fallbackPreferredModel: 'openai/gpt-5',
        defaultModel: 'anthropic/claude-sonnet-4',
        preferSessionPreferredModel: true
      })
    ).toBe('openai/gpt-5');
  });

  it('preserves the current valid model when a draft session materializes before the new session metadata exists', () => {
    expect(
      resolveSelectedModelValue({
        currentSelectedModel: 'openai/gpt-5',
        modelOptions,
        fallbackPreferredModel: 'anthropic/claude-sonnet-4',
        defaultModel: 'anthropic/claude-sonnet-4',
        preferSessionPreferredModel: true,
        preserveCurrentSelectedModelOnSessionChange: true
      })
    ).toBe('openai/gpt-5');
  });

  it('still falls back when the current model is no longer valid during draft session materialization', () => {
    expect(
      resolveSelectedModelValue({
        currentSelectedModel: 'missing/model',
        modelOptions,
        fallbackPreferredModel: 'openai/gpt-5',
        defaultModel: 'anthropic/claude-sonnet-4',
        preferSessionPreferredModel: true,
        preserveCurrentSelectedModelOnSessionChange: true
      })
    ).toBe('openai/gpt-5');
  });

  it('uses the recent same-runtime model when the current session has no valid preferred model', () => {
    expect(
      resolveSelectedModelValue({
        currentSelectedModel: 'missing/model',
        modelOptions,
        fallbackPreferredModel: 'openai/gpt-5',
        defaultModel: 'anthropic/claude-sonnet-4'
      })
    ).toBe('openai/gpt-5');
  });

  it('falls back to the global default model when the recent same-runtime model is unavailable', () => {
    expect(
      resolveSelectedModelValue({
        currentSelectedModel: 'missing/model',
        modelOptions,
        fallbackPreferredModel: 'missing/model',
        defaultModel: 'anthropic/claude-sonnet-4'
      })
    ).toBe('anthropic/claude-sonnet-4');
  });

  it('falls back to the first available model when no candidate is valid', () => {
    expect(
      resolveSelectedModelValue({
        currentSelectedModel: 'missing/model',
        modelOptions,
        selectedSessionPreferredModel: 'missing/model',
        fallbackPreferredModel: 'missing/model',
        defaultModel: 'missing/model'
      })
    ).toBe('anthropic/claude-sonnet-4');
  });
});

describe('shouldClearPendingProjectRootOverride', () => {
  it('does not clear an unrelated session project override', () => {
    expect(
      shouldClearPendingProjectRootOverride({
        pendingProjectRoot: '/tmp/project-alpha',
        pendingProjectRootSessionKey: 'draft-project-alpha',
        sessionKey: 'session-existing',
        selectedSessionProjectRoot: '/tmp/project-alpha'
      })
    ).toBe(false);
  });

  it('clears the override only after the bound session reflects the same project root', () => {
    expect(
      shouldClearPendingProjectRootOverride({
        pendingProjectRoot: '/tmp/project-alpha',
        pendingProjectRootSessionKey: 'draft-after-refresh',
        sessionKey: 'draft-after-refresh',
        selectedSessionProjectRoot: '/tmp/project-alpha'
      })
    ).toBe(true);
  });
});

describe('resolveRecentSessionPreferredModel', () => {
  it('returns the most recent preferred model from the same runtime', () => {
    const sessions = [
      createSession({
        key: 'native-1',
        sessionType: 'native',
        preferredModel: 'anthropic/claude-sonnet-4',
        updatedAt: '2026-03-18T01:00:00.000Z'
      }),
      createSession({
        key: 'codex-1',
        sessionType: 'codex',
        preferredModel: 'openai/gpt-5',
        updatedAt: '2026-03-18T03:00:00.000Z'
      }),
      createSession({
        key: 'codex-2',
        sessionType: 'codex',
        preferredModel: 'anthropic/claude-sonnet-4',
        updatedAt: '2026-03-18T02:00:00.000Z'
      })
    ];

    expect(
      resolveRecentSessionPreferredModel({
        sessions,
        selectedSessionKey: 'draft',
        sessionType: 'codex'
      })
    ).toBe('openai/gpt-5');
  });

  it('ignores the currently selected session and sessions without preferred models', () => {
    const sessions = [
      createSession({
        key: 'codex-current',
        sessionType: 'codex',
        preferredModel: 'openai/gpt-5',
        updatedAt: '2026-03-18T03:00:00.000Z'
      }),
      createSession({
        key: 'codex-empty',
        sessionType: 'codex',
        updatedAt: '2026-03-18T04:00:00.000Z'
      }),
      createSession({
        key: 'codex-fallback',
        sessionType: 'codex',
        preferredModel: 'anthropic/claude-sonnet-4',
        updatedAt: '2026-03-18T02:00:00.000Z'
      })
    ];

    expect(
      resolveRecentSessionPreferredModel({
        sessions,
        selectedSessionKey: 'codex-current',
        sessionType: 'codex'
      })
    ).toBe('anthropic/claude-sonnet-4');
  });
});

describe('resolveSelectedThinkingLevelValue', () => {
  it('keeps the current selected thinking when it is still valid', () => {
    expect(
      resolveSelectedThinkingLevelValue({
        currentSelectedThinkingLevel: 'high',
        supportedThinkingLevels: thinkingLevels,
        selectedSessionPreferredThinking: 'medium',
        fallbackPreferredThinking: 'minimal',
        defaultThinkingLevel: 'off'
      })
    ).toBe('high');
  });

  it('prefers the persisted session thinking after switching sessions', () => {
    expect(
      resolveSelectedThinkingLevelValue({
        currentSelectedThinkingLevel: 'high',
        supportedThinkingLevels: thinkingLevels,
        selectedSessionPreferredThinking: 'medium',
        fallbackPreferredThinking: 'minimal',
        defaultThinkingLevel: 'off',
        preferSessionPreferredThinking: true
      })
    ).toBe('medium');
  });

  it('preserves the current valid thinking when a draft session materializes before metadata exists', () => {
    expect(
      resolveSelectedThinkingLevelValue({
        currentSelectedThinkingLevel: 'high',
        supportedThinkingLevels: thinkingLevels,
        fallbackPreferredThinking: 'minimal',
        defaultThinkingLevel: 'off',
        preferSessionPreferredThinking: true,
        preserveCurrentSelectedThinkingOnSessionChange: true
      })
    ).toBe('high');
  });

  it('falls back to the model default when no current or persisted thinking is valid', () => {
    expect(
      resolveSelectedThinkingLevelValue({
        currentSelectedThinkingLevel: null,
        supportedThinkingLevels: thinkingLevels,
        fallbackPreferredThinking: null,
        defaultThinkingLevel: 'medium'
      })
    ).toBe('medium');
  });
});

describe('resolveRecentSessionPreferredThinking', () => {
  it('returns the most recent preferred thinking from the same runtime', () => {
    const sessions = [
      createSession({
        key: 'native-1',
        sessionType: 'native',
        preferredThinking: 'low',
        updatedAt: '2026-03-18T01:00:00.000Z'
      }),
      createSession({
        key: 'codex-1',
        sessionType: 'codex',
        preferredThinking: 'high',
        updatedAt: '2026-03-18T03:00:00.000Z'
      }),
      createSession({
        key: 'codex-2',
        sessionType: 'codex',
        preferredThinking: 'medium',
        updatedAt: '2026-03-18T02:00:00.000Z'
      })
    ];

    expect(
      resolveRecentSessionPreferredThinking({
        sessions,
        selectedSessionKey: 'draft',
        sessionType: 'codex'
      })
    ).toBe('high');
  });
});
