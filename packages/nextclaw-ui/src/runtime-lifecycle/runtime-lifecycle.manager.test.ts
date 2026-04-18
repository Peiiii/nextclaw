import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BootstrapStatusView } from '@/api/types';
import { appQueryClient } from '@/app-query-client';
import { t } from '@/lib/i18n';
import {
  runtimeLifecycleManager,
  isTransientRuntimeConnectionErrorMessage,
} from '@/runtime-lifecycle/runtime-lifecycle.manager';
import { useRuntimeLifecycleStore } from '@/runtime-lifecycle/runtime-lifecycle.store';

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

describe('runtimeLifecycleManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    runtimeLifecycleManager.resetForTests();
  });

  afterEach(() => {
    runtimeLifecycleManager.resetForTests();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('keeps cold start in cold-starting when transport fails before the first ready state', () => {
    expect(
      runtimeLifecycleManager.reportTransportFailure(new Error('Failed to fetch'))
    ).toBe(true);

    expect(useRuntimeLifecycleStore.getState().snapshot.phase).toBe('cold-starting');
  });

  it('enters startup-failed when bootstrap explicitly reports an error before the first ready state', () => {
    runtimeLifecycleManager.reportBootstrapStatus({
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

    expect(useRuntimeLifecycleStore.getState().snapshot.phase).toBe('startup-failed');
  });

  it('enters recovering only after the page has previously reached ready', async () => {
    const invalidateQueriesSpy = vi
      .spyOn(appQueryClient, 'invalidateQueries')
      .mockResolvedValue(undefined as never);
    const refetchQueriesSpy = vi
      .spyOn(appQueryClient, 'refetchQueries')
      .mockResolvedValue(undefined as never);

    runtimeLifecycleManager.reportBootstrapStatus(readyBootstrapStatus);
    runtimeLifecycleManager.handleConnectionInterrupted('websocket error');

    expect(useRuntimeLifecycleStore.getState().snapshot.phase).toBe('recovering');

    runtimeLifecycleManager.reportBootstrapStatus(readyBootstrapStatus);

    expect(useRuntimeLifecycleStore.getState().snapshot.phase).toBe('ready');
    expect(invalidateQueriesSpy).toHaveBeenCalled();
    expect(refetchQueriesSpy).toHaveBeenCalledWith({ type: 'active' });
  });

  it('marks recovery as stalled after the timeout window elapses', async () => {
    runtimeLifecycleManager.reportBootstrapStatus(readyBootstrapStatus);
    runtimeLifecycleManager.handleConnectionInterrupted('websocket error');

    await vi.advanceTimersByTimeAsync(30_000);

    expect(useRuntimeLifecycleStore.getState().snapshot.phase).toBe('stalled');
  });

  it('maps transient chat errors to friendly recovery copy while recovering', () => {
    runtimeLifecycleManager.reportBootstrapStatus(readyBootstrapStatus);
    runtimeLifecycleManager.handleConnectionInterrupted('Failed to fetch');

    expect(
      runtimeLifecycleManager.getDisplayMessage(
        'NCP fetch failed for POST /api/ncp/agent: Error: Failed to fetch'
      )
    ).toBe(t('runtimeControlRecoveringHelp'));
  });

  it('keeps only transport-level failures in the recovery flow', () => {
    expect(isTransientRuntimeConnectionErrorMessage('Failed to fetch')).toBe(true);
    expect(
      isTransientRuntimeConnectionErrorMessage('HTTP 500 internal server error')
    ).toBe(false);
  });
});
