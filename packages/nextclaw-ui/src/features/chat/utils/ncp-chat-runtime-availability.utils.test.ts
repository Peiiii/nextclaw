import { describe, expect, it } from 'vitest';
import { t } from '@/shared/lib/i18n';
import type { SystemStatusView } from '@/features/system-status';
import {
  isNcpChatRuntimeBlocked,
  resolveNcpChatRuntimeMessage,
  resolveNcpChatSendErrorMessage,
} from './ncp-chat-runtime-availability.utils';

function createStatus(overrides: Partial<SystemStatusView> = {}): SystemStatusView {
  return {
    lifecyclePhase: 'ready',
    phase: 'ready',
    connectionStatus: 'connected',
    hasReachedReady: true,
    lastReadyAt: Date.now(),
    recoveryStartedAt: null,
    bootstrapStatus: {
      phase: 'ready',
      ncpAgent: {
        state: 'ready',
      },
      pluginHydration: {
        state: 'ready',
        loadedPluginCount: 1,
        totalPluginCount: 1,
      },
      channels: {
        state: 'ready',
        enabled: [],
      },
      remote: {
        state: 'pending',
      },
    },
    lastError: null,
    lastTransportError: null,
    runtimeControlView: null,
    runtimeControlError: null,
    activeSystemAction: null,
    lastSystemActionError: null,
    ...overrides,
  };
}

describe('ncp-chat-runtime-availability.utils', () => {
  it('allows chat send when the NCP agent is ready even if the aggregate phase is stalled', () => {
    expect(isNcpChatRuntimeBlocked(createStatus())).toBe(false);
    expect(
      isNcpChatRuntimeBlocked(
        createStatus({
          lifecyclePhase: 'stalled',
          phase: 'stalled',
          connectionStatus: 'disconnected',
          recoveryStartedAt: Date.now(),
        })
      )
    ).toBe(false);
  });

  it('blocks chat send while the NCP agent is not ready', () => {
    expect(
      isNcpChatRuntimeBlocked(
        createStatus({
          bootstrapStatus: null,
        })
      )
    ).toBe(true);
  });

  it('uses the startup message during cold start', () => {
    expect(
      resolveNcpChatRuntimeMessage(
        createStatus({
          lifecyclePhase: 'cold-starting',
          phase: 'cold-starting',
          connectionStatus: 'connecting',
          hasReachedReady: false,
          lastReadyAt: null,
        })
      )
    ).toBe(t('chatRuntimeInitializing'));
  });

  it('uses the bootstrap error when startup failed', () => {
    expect(
      resolveNcpChatRuntimeMessage(
        createStatus({
          lifecyclePhase: 'startup-failed',
          phase: 'startup-failed',
          connectionStatus: 'disconnected',
          hasReachedReady: false,
          lastReadyAt: null,
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
        })
      )
    ).toBe('boom');
  });

  it('prefers the centralized action message while a system action is running', () => {
    expect(
      resolveNcpChatRuntimeMessage(
        createStatus({
          activeSystemAction: {
            action: 'restart-service',
            lifecycle: 'recovering',
            serviceState: null,
            message: 'NextClaw 正在恢复连接',
          },
        })
      )
    ).toBe('NextClaw 正在恢复连接');
  });

  it('maps transient chat errors to friendly recovery copy while recovering', () => {
    expect(
      resolveNcpChatSendErrorMessage({
        message: 'NCP fetch failed for POST /api/ncp/agent: Error: Failed to fetch',
        status: createStatus({
          lifecyclePhase: 'recovering',
          phase: 'recovering',
          connectionStatus: 'connecting',
          recoveryStartedAt: Date.now(),
          lastError: 'Failed to fetch',
          lastTransportError: 'Failed to fetch',
        }),
      })
    ).toBe(t('runtimeControlRecoveringHelp'));
  });

  it('suppresses transient transport errors after recovery stalls', () => {
    expect(
      resolveNcpChatSendErrorMessage({
        message: 'NCP fetch failed for POST /api/ncp/agent: Error: Failed to fetch',
        status: createStatus({
          lifecyclePhase: 'stalled',
          phase: 'stalled',
          connectionStatus: 'disconnected',
          recoveryStartedAt: Date.now(),
          lastError: 'Failed to fetch',
          lastTransportError: 'Failed to fetch',
        }),
      })
    ).toBeNull();
  });
});
