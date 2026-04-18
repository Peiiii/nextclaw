import { describe, expect, it } from 'vitest';
import { resolveChatRuntimeBootstrapStage } from './chat-runtime-bootstrap-state';

describe('resolveChatRuntimeBootstrapStage', () => {
  it('treats missing bootstrap status as initializing', () => {
    expect(resolveChatRuntimeBootstrapStage(undefined)).toBe('initializing');
  });

  it('returns ready when the ncp agent is ready', () => {
    expect(
      resolveChatRuntimeBootstrapStage({
        phase: 'ready',
        ncpAgent: { state: 'ready' },
        pluginHydration: { state: 'ready', loadedPluginCount: 1, totalPluginCount: 1 },
        channels: { state: 'ready', enabled: [] },
        remote: { state: 'disabled' },
      })
    ).toBe('ready');
  });

  it('returns error when the ncp agent startup failed', () => {
    expect(
      resolveChatRuntimeBootstrapStage({
        phase: 'error',
        ncpAgent: { state: 'error', error: 'boom' },
        pluginHydration: { state: 'ready', loadedPluginCount: 1, totalPluginCount: 1 },
        channels: { state: 'pending', enabled: [] },
        remote: { state: 'pending' },
        lastError: 'boom',
      })
    ).toBe('error');
  });
});
