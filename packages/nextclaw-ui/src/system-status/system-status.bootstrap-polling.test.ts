import { beforeEach, describe, expect, it } from 'vitest';
import { systemStatusManager } from './system-status.manager';
import { useSystemStatusStore } from './system-status.store';

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
      500
    );
  });

  it('keeps polling while ncp agent is still initializing', () => {
    expect(
      systemStatusManager.getRuntimeBootstrapPollInterval({
        phase: 'shell-ready',
        ncpAgent: {
          state: 'running',
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
      })
    ).toBe(500);
  });

  it('continues polling even when bootstrap status reports an ncp agent error', () => {
    expect(
      systemStatusManager.getRuntimeBootstrapPollInterval({
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
      })
    ).toBe(500);
  });

  it('stops polling once the ncp agent is ready', () => {
    expect(
      systemStatusManager.getRuntimeBootstrapPollInterval({
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
      })
    ).toBe(500);
  });
});
