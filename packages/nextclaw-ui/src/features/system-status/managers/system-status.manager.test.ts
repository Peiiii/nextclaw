import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BootstrapStatusView } from '@/shared/lib/api';
import { appQueryClient } from '@/app-query-client';
import { t } from '@/shared/lib/i18n';
import {
  isTransientRuntimeConnectionErrorMessage,
  systemStatusManager,
} from './system-status.manager';
import { useSystemStatusStore } from '@/features/system-status/stores/system-status.store';

const readyBootstrapStatus: BootstrapStatusView = {
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
    state: 'disabled',
  },
};

describe('systemStatusManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    systemStatusManager.resetForTests();
  });

  afterEach(() => {
    systemStatusManager.resetForTests();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('keeps cold start in cold-starting when transport fails before the first ready state', () => {
    expect(
      systemStatusManager.reportTransportFailure(new Error('Failed to fetch'))
    ).toBe(true);

    expect(useSystemStatusStore.getState().state.lifecyclePhase).toBe(
      'cold-starting'
    );
  });

  it('enters startup-failed when bootstrap explicitly reports an error before the first ready state', () => {
    systemStatusManager.reportBootstrapStatus({
      phase: 'error',
      ncpAgent: {
        state: 'error',
        error: 'startup failed',
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
      lastError: 'startup failed',
    });

    expect(useSystemStatusStore.getState().state.lifecyclePhase).toBe(
      'startup-failed'
    );
  });

  it('enters recovering only after the page has previously reached ready', async () => {
    const invalidateQueriesSpy = vi
      .spyOn(appQueryClient, 'invalidateQueries')
      .mockResolvedValue(undefined as never);
    const refetchQueriesSpy = vi
      .spyOn(appQueryClient, 'refetchQueries')
      .mockResolvedValue(undefined as never);

    systemStatusManager.reportBootstrapStatus(readyBootstrapStatus);
    systemStatusManager.handleConnectionInterrupted('websocket error');

    expect(useSystemStatusStore.getState().state.lifecyclePhase).toBe(
      'recovering'
    );

    systemStatusManager.reportBootstrapStatus(readyBootstrapStatus);

    expect(useSystemStatusStore.getState().state.lifecyclePhase).toBe('ready');
    expect(invalidateQueriesSpy).toHaveBeenCalled();
    expect(refetchQueriesSpy).toHaveBeenCalledWith({ type: 'active' });
  });

  it('marks recovery as stalled after the timeout window elapses', async () => {
    systemStatusManager.reportBootstrapStatus(readyBootstrapStatus);
    systemStatusManager.handleConnectionInterrupted('websocket error');

    await vi.advanceTimersByTimeAsync(30_000);

    expect(useSystemStatusStore.getState().state.lifecyclePhase).toBe('stalled');
  });

  it('maps transient chat errors to friendly recovery copy while recovering', () => {
    systemStatusManager.reportBootstrapStatus(readyBootstrapStatus);
    systemStatusManager.handleConnectionInterrupted('Failed to fetch');

    expect(
      systemStatusManager.getDisplayMessage(
        'NCP fetch failed for POST /api/ncp/agent: Error: Failed to fetch'
      )
    ).toBe(t('runtimeControlRecoveringHelp'));
  });

  it('suppresses transient transport errors after recovery stalls', async () => {
    systemStatusManager.reportBootstrapStatus(readyBootstrapStatus);
    systemStatusManager.handleConnectionInterrupted('Failed to fetch');

    await vi.advanceTimersByTimeAsync(30_000);

    expect(
      systemStatusManager.getDisplayMessage(
        'NCP fetch failed for POST /api/ncp/agent: Error: Failed to fetch'
      )
    ).toBeNull();
  });

  it('keeps only transport-level failures in the recovery flow', () => {
    expect(isTransientRuntimeConnectionErrorMessage('Failed to fetch')).toBe(
      true
    );
    expect(
      isTransientRuntimeConnectionErrorMessage('HTTP 500 internal server error')
    ).toBe(false);
  });
});
