import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserRealtimeRecoveryService } from '@/shared/lib/transport/browser-realtime-recovery.service';

describe('BrowserRealtimeRecoveryService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requests recovery only when the page can actively reconnect', () => {
    let visibilityState: DocumentVisibilityState = 'hidden';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibilityState);
    const requestRecovery = vi.fn();
    const recovery = new BrowserRealtimeRecoveryService(requestRecovery);

    recovery.start();
    window.dispatchEvent(new Event('online'));
    expect(requestRecovery).not.toHaveBeenCalled();

    visibilityState = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('online'));
    expect(requestRecovery).toHaveBeenCalledTimes(2);

    recovery.stop();
    document.dispatchEvent(new Event('visibilitychange'));
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
});
