import { describe, expect, it } from 'vitest';
import { t } from '@/lib/i18n';
import {
  resolveChatRuntimeMessage,
  resolveRuntimeConnectionStatus,
  toRuntimeLifecycleView,
} from './hooks/use-runtime-lifecycle-status';

describe('resolveRuntimeConnectionStatus', () => {
  it('maps cold-starting to connecting', () => {
    expect(resolveRuntimeConnectionStatus('cold-starting')).toBe('connecting');
  });

  it('maps ready to connected', () => {
    expect(resolveRuntimeConnectionStatus('ready')).toBe('connected');
  });

  it('maps stalled to disconnected', () => {
    expect(resolveRuntimeConnectionStatus('stalled')).toBe('disconnected');
  });
});

describe('resolveChatRuntimeMessage', () => {
  it('uses the startup message during cold start', () => {
    expect(
      resolveChatRuntimeMessage({
        phase: 'cold-starting',
        hasReachedReady: false,
        lastReadyAt: null,
        recoveryStartedAt: null,
        bootstrapStatus: null,
        lastError: null,
        lastTransportError: null,
      })
    ).toBe(t('chatRuntimeInitializing'));
  });

  it('uses the bootstrap error when startup failed', () => {
    expect(
      resolveChatRuntimeMessage({
        phase: 'startup-failed',
        hasReachedReady: false,
        lastReadyAt: null,
        recoveryStartedAt: null,
        bootstrapStatus: {
          phase: 'error',
          ncpAgent: {
            state: 'error',
            error: 'boom',
          },
          pluginHydration: {
            state: 'pending',
            loadedPluginCount: 0,
            totalPluginCount: 0,
          },
          channels: {
            state: 'pending',
            enabled: [],
          },
          remote: {
            state: 'pending',
          },
          lastError: 'boom',
        },
        lastError: null,
        lastTransportError: null,
      })
    ).toBe('boom');
  });

  it('hides the transient recovery banner copy during reconnecting', () => {
    expect(
      resolveChatRuntimeMessage({
        phase: 'recovering',
        hasReachedReady: true,
        lastReadyAt: Date.now(),
        recoveryStartedAt: Date.now(),
        bootstrapStatus: null,
        lastError: 'Failed to fetch',
        lastTransportError: 'Failed to fetch',
      })
    ).toBeNull();
  });
});

describe('toRuntimeLifecycleView', () => {
  it('derives blocked state and stalled copy from the lifecycle snapshot', () => {
    expect(
      toRuntimeLifecycleView({
        phase: 'stalled',
        hasReachedReady: true,
        lastReadyAt: Date.now(),
        recoveryStartedAt: Date.now(),
        bootstrapStatus: null,
        lastError: 'Failed to fetch',
        lastTransportError: 'Failed to fetch',
      })
    ).toMatchObject({
      chatRuntimeBlocked: true,
      chatRuntimeMessage: t('runtimeRecoveryTimedOut'),
      connectionStatus: 'disconnected',
    });
  });
});
