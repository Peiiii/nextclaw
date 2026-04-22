import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PwaInstallManager } from '@/features/pwa/managers/pwa-install.manager';
import {
  PWA_INSTALL_BANNER_DISMISS_STORAGE_KEY,
  PWA_INSTALL_BANNER_LEGACY_UNTIL_STORAGE_KEY
} from '@/features/pwa/utils/pwa-install-banner.utils';
import { usePwaStore, createInitialPwaState } from '@/features/pwa/stores/pwa.store';

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

function createBeforeInstallPromptEvent(outcome: 'accepted' | 'dismissed' = 'accepted'): BeforeInstallPromptEvent {
  const event = new Event('beforeinstallprompt') as BeforeInstallPromptEvent;
  event.preventDefault = vi.fn();
  event.prompt = vi.fn();
  event.userChoice = Promise.resolve({ outcome, platform: 'web' });
  return event;
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
    window.localStorage.clear();
  });

  afterEach(() => {
    manager.resetForTests();
    window.localStorage.clear();
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

  it('keeps install banner dismissed after beforeinstallprompt fires again', () => {
    manager.start();
    window.dispatchEvent(createBeforeInstallPromptEvent());

    manager.dismissInstallPrompt();
    expect(usePwaStore.getState().dismissedInstallPrompt).toBe(true);

    window.dispatchEvent(createBeforeInstallPromptEvent());

    expect(usePwaStore.getState().dismissedInstallPrompt).toBe(true);
    expect(window.localStorage.getItem(PWA_INSTALL_BANNER_DISMISS_STORAGE_KEY)).toBeTruthy();
  });

  it('keeps install banner dismissed after user dismisses the native install prompt', async () => {
    manager.start();
    const promptEvent = createBeforeInstallPromptEvent('dismissed');
    window.dispatchEvent(promptEvent);

    const outcome = await manager.promptInstall();

    expect(outcome).toBe('dismissed');
    expect(promptEvent.prompt).toHaveBeenCalledTimes(1);
    expect(usePwaStore.getState().dismissedInstallPrompt).toBe(true);
    expect(window.localStorage.getItem(PWA_INSTALL_BANNER_DISMISS_STORAGE_KEY)).toBe('1');
  });

  it('hydrates dismissed state from persisted dismiss flag on fresh store init', () => {
    window.localStorage.setItem(
      PWA_INSTALL_BANNER_DISMISS_STORAGE_KEY,
      '1'
    );

    usePwaStore.setState(createInitialPwaState());

    expect(usePwaStore.getState().dismissedInstallPrompt).toBe(true);
  });

  it('migrates legacy snooze timestamps into the permanent dismiss flag', () => {
    window.localStorage.setItem(
      PWA_INSTALL_BANNER_LEGACY_UNTIL_STORAGE_KEY,
      String(Date.now() + 60_000)
    );

    usePwaStore.setState(createInitialPwaState());

    expect(usePwaStore.getState().dismissedInstallPrompt).toBe(true);
    expect(window.localStorage.getItem(PWA_INSTALL_BANNER_DISMISS_STORAGE_KEY)).toBe('1');
    expect(window.localStorage.getItem(PWA_INSTALL_BANNER_LEGACY_UNTIL_STORAGE_KEY)).toBeNull();
  });
});
