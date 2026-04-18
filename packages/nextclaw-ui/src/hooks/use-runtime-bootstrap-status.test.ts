import { describe, expect, it } from 'vitest';
import { resolveBootstrapStatusPollInterval } from './use-runtime-bootstrap-status';

describe('resolveBootstrapStatusPollInterval', () => {
  it('keeps polling while bootstrap status is missing', () => {
    expect(resolveBootstrapStatusPollInterval(undefined)).toBe(500);
  });

  it('keeps polling while ncp agent is still initializing', () => {
    expect(
      resolveBootstrapStatusPollInterval({
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
      resolveBootstrapStatusPollInterval({
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
      resolveBootstrapStatusPollInterval({
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
});
