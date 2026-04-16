import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PwaInstallManager } from '@/pwa/managers/pwa-install.manager';
import { usePwaStore, createInitialPwaState } from '@/pwa/stores/pwa.store';

function createMatchMedia(matches = false): typeof window.matchMedia {
  return vi.fn().mockImplementation(() => ({
    matches,
    media: '(display-mode: standalone)',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }));
}

describe('PwaInstallManager', () => {
  let manager: PwaInstallManager;

  beforeEach(() => {
    manager = new PwaInstallManager();
    usePwaStore.setState(createInitialPwaState());
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: createMatchMedia(false)
    });
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true
    });
    Object.defineProperty(window, 'nextclawDesktop', {
      configurable: true,
      value: undefined
    });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {}
    });
  });

  afterEach(() => {
    manager.resetForTests();
  });

  it('marks desktop host as suppressed', () => {
    Object.defineProperty(window, 'nextclawDesktop', {
      configurable: true,
      value: {}
    });

    manager.start();

    const state = usePwaStore.getState();
    expect(state.installability).toBe('suppressed');
    expect(state.blockedReason).toBe('desktop-host');
  });

  it('marks installed when display mode is standalone', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: createMatchMedia(true)
    });

    manager.start();

    const state = usePwaStore.getState();
    expect(state.installability).toBe('installed');
    expect(state.installMethod).toBe('none');
  });

  it('falls back to manual install when prompt event is unavailable', () => {
    manager.start();

    const state = usePwaStore.getState();
    expect(state.installability).toBe('available');
    expect(state.installMethod).toBe('manual');
  });

  it('marks insecure non-local origins as unsupported', () => {
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: false
    });
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('http://192.168.1.7:5174')
    });

    manager.start();

    const state = usePwaStore.getState();
    expect(state.installability).toBe('unsupported');
    expect(state.blockedReason).toBe('insecure-context');
  });
});
