import { describe, expect, it } from 'vitest';
import {
  resolveSystemConnectionStatus,
  toSystemStatusView,
} from '../system-status.utils';

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

describe('toSystemStatusView', () => {
  it('maps stalled to factual connection and lifecycle view fields', () => {
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
      connectionStatus: 'disconnected',
      phase: 'stalled',
    });
  });
});
