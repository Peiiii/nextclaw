import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserRealtimeRecoveryService } from '@/shared/lib/transport/browser-realtime-recovery.service';

describe('BrowserRealtimeRecoveryService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('requests recovery for every supported foreground lifecycle signal', () => {
    let visibilityState: DocumentVisibilityState = 'hidden';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibilityState);
    const requestRecovery = vi.fn();
    const recovery = new BrowserRealtimeRecoveryService(requestRecovery);

    recovery.start();
    window.dispatchEvent(new Event('online'));
    expect(requestRecovery).not.toHaveBeenCalled();

    visibilityState = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('online'));
    expect(requestRecovery).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(250);
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    expect(requestRecovery).toHaveBeenCalledTimes(2);

    recovery.stop();
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    window.dispatchEvent(new Event('focus'));
    expect(requestRecovery).toHaveBeenCalledTimes(2);
  });

  it('keeps start and stop idempotent', () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    const requestRecovery = vi.fn();
    const recovery = new BrowserRealtimeRecoveryService(requestRecovery);

    recovery.start();
    recovery.start();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(requestRecovery).toHaveBeenCalledTimes(1);

    recovery.stop();
    recovery.stop();
  });

  it('does not replace the first connection for an ordinary initial pageshow', () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    const requestRecovery = vi.fn();
    const recovery = new BrowserRealtimeRecoveryService(requestRecovery);

    recovery.start();
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }));

    expect(requestRecovery).not.toHaveBeenCalled();
    recovery.stop();
  });
});
