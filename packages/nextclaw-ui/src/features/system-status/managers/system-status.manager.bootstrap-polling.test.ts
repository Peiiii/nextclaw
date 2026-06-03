import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { systemStatusManager } from './system-status.manager';
import { appQueryClient } from '@/app-query-client';
import type { BootstrapStatusView } from '@/shared/lib/api';

const initializingBootstrapStatus: BootstrapStatusView = {
  phase: 'shell-ready',
  ncpAgent: {
    state: 'running',
  },
  extensionLoading: {
    state: 'pending',
    loadedExtensionCount: 0,
    totalExtensionCount: 0,
  },
  channels: {
    state: 'pending',
    enabled: [],
  },
  remote: {
    state: 'pending',
  },
};

const errorBootstrapStatus: BootstrapStatusView = {
  phase: 'error',
  ncpAgent: {
    state: 'error',
    error: 'startup failed',
  },
  extensionLoading: {
    state: 'pending',
    loadedExtensionCount: 0,
    totalExtensionCount: 0,
  },
  channels: {
    state: 'pending',
    enabled: [],
  },
  remote: {
    state: 'pending',
  },
  lastError: 'startup failed',
};

const readyBootstrapStatus: BootstrapStatusView = {
  phase: 'ready',
  ncpAgent: {
    state: 'ready',
  },
  extensionLoading: {
    state: 'ready',
    loadedExtensionCount: 1,
    totalExtensionCount: 1,
  },
  channels: {
    state: 'ready',
    enabled: [],
  },
  remote: {
    state: 'disabled',
  },
};

describe('getRuntimeBootstrapPollInterval', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    systemStatusManager.resetForTests();
  });

  afterEach(() => {
    systemStatusManager.resetForTests();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('keeps polling while bootstrap status is missing', () => {
    expect(systemStatusManager.getRuntimeBootstrapPollInterval(undefined)).toBe(
      1000
    );
  });

  it('keeps polling while ncp agent is still initializing', () => {
    expect(
      systemStatusManager.getRuntimeBootstrapPollInterval(
        initializingBootstrapStatus
      )
    ).toBe(1000);
  });

  it('starts hot backoff when bootstrap status reports an ncp agent error', () => {
    systemStatusManager.reportBootstrapStatus(errorBootstrapStatus);

    expect(
      systemStatusManager.getRuntimeBootstrapPollInterval(errorBootstrapStatus)
    ).toBe(500);
  });

  it('stops polling once the ncp agent is ready', () => {
    expect(
      systemStatusManager.getRuntimeBootstrapPollInterval(readyBootstrapStatus)
    ).toBe(false);
  });

  it('keeps polling while the runtime is recovering even if the last bootstrap status was ready', () => {
    systemStatusManager.reportBootstrapStatus(readyBootstrapStatus);
    systemStatusManager.handleConnectionInterrupted('websocket error');

    expect(
      systemStatusManager.getRuntimeBootstrapPollInterval(readyBootstrapStatus)
    ).toBe(500);
  });

  it('backs off polling after transport failures', () => {
    systemStatusManager.reportBootstrapQueryError(new Error('Failed to fetch'));
    expect(systemStatusManager.getRuntimeBootstrapPollInterval(undefined)).toBe(
      500
    );

    systemStatusManager.reportBootstrapQueryError(new Error('Failed to fetch'));
    expect(
      systemStatusManager.getRuntimeBootstrapPollInterval(undefined)
    ).toBe(1000);

    systemStatusManager.reportBootstrapQueryError(new Error('Failed to fetch'));
    expect(
      systemStatusManager.getRuntimeBootstrapPollInterval(undefined)
    ).toBe(2000);
  });

  it('slows down after the hot recovery and long failure windows', async () => {
    systemStatusManager.reportBootstrapQueryError(new Error('Failed to fetch'));

    await vi.advanceTimersByTimeAsync(31_000);
    expect(systemStatusManager.getRuntimeBootstrapPollInterval(undefined)).toBe(
      10_000
    );

    systemStatusManager.reportBootstrapQueryError(new Error('Failed to fetch'));
    systemStatusManager.reportBootstrapQueryError(new Error('Failed to fetch'));
    expect(systemStatusManager.getRuntimeBootstrapPollInterval(undefined)).toBe(
      30_000
    );

    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(systemStatusManager.getRuntimeBootstrapPollInterval(undefined)).toBe(
      60_000
    );
  });

  it('lets manual runtime probe trigger one immediate interval after readiness stopped polling', async () => {
    const refetchQueriesSpy = vi
      .spyOn(appQueryClient, 'refetchQueries')
      .mockResolvedValue(undefined as never);

    systemStatusManager.reportBootstrapStatus(readyBootstrapStatus);
    expect(
      systemStatusManager.getRuntimeBootstrapPollInterval(readyBootstrapStatus)
    ).toBe(false);

    systemStatusManager.requestRuntimeBootstrapProbeNow();

    expect(refetchQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['runtime-bootstrap-status'],
    });
    expect(
      systemStatusManager.getRuntimeBootstrapPollInterval(readyBootstrapStatus)
    ).toBe(0);
    expect(
      systemStatusManager.getRuntimeBootstrapPollInterval(readyBootstrapStatus)
    ).toBe(false);
  });
});
