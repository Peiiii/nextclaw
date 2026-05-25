import { beforeEach, describe, expect, it } from 'vitest';
import { systemStatusManager } from './system-status.manager';
import { useSystemStatusStore } from '@/features/system-status/stores/system-status.store';

describe('getRuntimeBootstrapPollInterval', () => {
  beforeEach(() => {
    useSystemStatusStore.setState({
      state: {
        ...useSystemStatusStore.getState().state,
        lifecyclePhase: 'cold-starting',
        hasReachedReady: false,
        activeSystemAction: null,
      },
    });
  });

  it('keeps polling while bootstrap status is missing', () => {
    expect(systemStatusManager.getRuntimeBootstrapPollInterval(undefined)).toBe(
      1000
    );
  });

  it('keeps polling while ncp agent is still initializing', () => {
    expect(
      systemStatusManager.getRuntimeBootstrapPollInterval({
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
      })
    ).toBe(1000);
  });

  it('continues polling even when bootstrap status reports an ncp agent error', () => {
    expect(
      systemStatusManager.getRuntimeBootstrapPollInterval({
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
      })
    ).toBe(2000);
  });

  it('stops polling once the ncp agent is ready', () => {
    expect(
      systemStatusManager.getRuntimeBootstrapPollInterval({
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
      })
    ).toBe(false);
  });

  it('keeps polling while the runtime is recovering even if the last bootstrap status was ready', () => {
    useSystemStatusStore.setState({
      state: {
        ...useSystemStatusStore.getState().state,
        lifecyclePhase: 'recovering',
        hasReachedReady: true,
        lastReadyAt: Date.now(),
        recoveryStartedAt: Date.now(),
      },
    });

    expect(
      systemStatusManager.getRuntimeBootstrapPollInterval({
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
      })
    ).toBe(1000);
  });

  it('backs off polling after transport failures', () => {
    expect(
      systemStatusManager.getRuntimeBootstrapPollInterval(undefined, 1)
    ).toBe(2000);
    expect(
      systemStatusManager.getRuntimeBootstrapPollInterval(undefined, 3)
    ).toBe(5000);
  });

});
