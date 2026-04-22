import { describe, expect, it } from 'vitest';
import { t } from '@/shared/lib/i18n';
import {
  resolveChatRuntimeMessage,
  resolveSystemConnectionStatus,
  toSystemStatusView,
} from './system-status.utils';

describe('resolveSystemConnectionStatus', () => {
  it('maps cold-starting to connecting', () => {
    expect(resolveSystemConnectionStatus('cold-starting')).toBe('connecting');
  });

  it('maps ready to connected', () => {
    expect(resolveSystemConnectionStatus('ready')).toBe('connected');
  });

  it('maps stalled to disconnected', () => {
    expect(resolveSystemConnectionStatus('stalled')).toBe('disconnected');
  });

  it('maps service-transitioning to connecting', () => {
    expect(resolveSystemConnectionStatus('service-transitioning')).toBe(
      'connecting'
    );
  });
});

describe('resolveChatRuntimeMessage', () => {
  it('uses the startup message during cold start', () => {
    expect(
      resolveChatRuntimeMessage({
        lifecyclePhase: 'cold-starting',
        hasReachedReady: false,
        lastReadyAt: null,
        recoveryStartedAt: null,
        bootstrapStatus: null,
        lastError: null,
        lastTransportError: null,
        runtimeControlView: null,
        runtimeControlError: null,
        activeSystemAction: null,
        lastSystemActionError: null,
      })
    ).toBe(t('chatRuntimeInitializing'));
  });

  it('uses the bootstrap error when startup failed', () => {
    expect(
      resolveChatRuntimeMessage({
        lifecyclePhase: 'startup-failed',
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
        runtimeControlView: null,
        runtimeControlError: null,
        activeSystemAction: null,
        lastSystemActionError: null,
      })
    ).toBe('boom');
  });

  it('prefers the centralized action message while a system action is running', () => {
    expect(
      resolveChatRuntimeMessage({
        lifecyclePhase: 'ready',
        hasReachedReady: true,
        lastReadyAt: Date.now(),
        recoveryStartedAt: null,
        bootstrapStatus: null,
        lastError: null,
        lastTransportError: null,
        runtimeControlView: null,
        runtimeControlError: null,
        activeSystemAction: {
          action: 'restart-service',
          lifecycle: 'recovering',
          serviceState: null,
          message: 'NextClaw 正在恢复连接',
        },
        lastSystemActionError: null,
      })
    ).toBe('NextClaw 正在恢复连接');
  });
});

describe('toSystemStatusView', () => {
  it('keeps stalled chat blocked without surfacing a timeout banner', () => {
    expect(
      toSystemStatusView({
        lifecyclePhase: 'stalled',
        hasReachedReady: true,
        lastReadyAt: Date.now(),
        recoveryStartedAt: Date.now(),
        bootstrapStatus: null,
        lastError: 'Failed to fetch',
        lastTransportError: 'Failed to fetch',
        runtimeControlView: null,
        runtimeControlError: null,
        activeSystemAction: null,
        lastSystemActionError: null,
      })
    ).toMatchObject({
      isChatBlocked: true,
      chatMessage: null,
      connectionStatus: 'disconnected',
      phase: 'stalled',
    });
  });
});
