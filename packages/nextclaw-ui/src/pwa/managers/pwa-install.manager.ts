import { usePwaStore, createInitialPwaState } from '@/pwa/stores/pwa.store';
import type { PwaInstallBlockedReason, PwaInstallMethod, PwaInstallPromptOutcome, PwaInstallabilityState } from '@/pwa/pwa.types';
import { pwaRuntimeManager } from '@/pwa/managers/pwa-runtime.manager';
import {
  clearPwaInstallBannerDismissal,
  dismissPwaInstallBanner,
  isPwaInstallBannerDismissed
} from '@/pwa/pwa-install-banner.storage';
import { t } from '@/lib/i18n';
import { toast } from 'sonner';

type InstallabilityResolution = {
  installability: PwaInstallabilityState;
  installMethod: PwaInstallMethod;
  blockedReason: PwaInstallBlockedReason;
};

export class PwaInstallManager {
  private started = false;
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private displayModeMediaQuery: MediaQueryList | null = null;

  start = () => {
    if (this.started || typeof window === 'undefined') {
      return;
    }

    this.started = true;
    window.addEventListener('beforeinstallprompt', this.handleBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', this.handleAppInstalled);

    if (typeof window.matchMedia === 'function') {
      this.displayModeMediaQuery = window.matchMedia('(display-mode: standalone)');
      this.bindDisplayModeListener(this.displayModeMediaQuery, this.handleDisplayModeChanged);
    }

    this.refreshState();
  };

  stop = () => {
    if (!this.started || typeof window === 'undefined') {
      return;
    }

    window.removeEventListener('beforeinstallprompt', this.handleBeforeInstallPrompt as EventListener);
    window.removeEventListener('appinstalled', this.handleAppInstalled);
    if (this.displayModeMediaQuery) {
      this.unbindDisplayModeListener(this.displayModeMediaQuery, this.handleDisplayModeChanged);
      this.displayModeMediaQuery = null;
    }

    this.deferredPrompt = null;
    this.started = false;
  };

  resetForTests = () => {
    this.stop();
    usePwaStore.setState(createInitialPwaState());
  };

  refreshState = () => {
    const resolution = this.resolveInstallability();
    usePwaStore.setState((state) => ({
      ...state,
      initialized: true,
      installability: resolution.installability,
      installMethod: resolution.installMethod,
      blockedReason: resolution.blockedReason,
      dismissedInstallPrompt: isPwaInstallBannerDismissed()
    }));
    void pwaRuntimeManager.syncUpdateAvailability();
  };

  dismissInstallPrompt = () => {
    dismissPwaInstallBanner();
    usePwaStore.setState({
      dismissedInstallPrompt: true
    });
  };

  promptInstall = async (): Promise<PwaInstallPromptOutcome> => {
    const resolution = this.resolveInstallability();
    if (resolution.installability !== 'available') {
      return 'unavailable';
    }

    if (resolution.installMethod === 'manual' || !this.deferredPrompt) {
      return 'manual';
    }

    this.deferredPrompt.prompt();
    const result = await this.deferredPrompt.userChoice;
    this.deferredPrompt = null;
    if (result.outcome === 'accepted') {
      clearPwaInstallBannerDismissal();
      this.refreshState();
      toast.success(t('pwaInstallAccepted'));
      return 'accepted';
    }

    this.dismissInstallPrompt();
    this.refreshState();
    return 'dismissed';
  };

  private handleBeforeInstallPrompt = (event: BeforeInstallPromptEvent) => {
    event.preventDefault();
    this.deferredPrompt = event;
    this.refreshState();
  };

  private handleAppInstalled = () => {
    this.deferredPrompt = null;
    clearPwaInstallBannerDismissal();
    usePwaStore.setState({
      dismissedInstallPrompt: true
    });
    toast.success(t('pwaInstalledToast'));
    this.refreshState();
  };

  private handleDisplayModeChanged = () => {
    this.refreshState();
  };

  private resolveInstallability = (): InstallabilityResolution => {
    if (this.isDevelopmentServer()) {
      return {
        installability: 'unsupported',
        installMethod: 'none',
        blockedReason: 'dev-server'
      };
    }

    if (this.hasDesktopHost()) {
      return {
        installability: 'suppressed',
        installMethod: 'none',
        blockedReason: 'desktop-host'
      };
    }

    if (this.isStandalone()) {
      return {
        installability: 'installed',
        installMethod: 'none',
        blockedReason: null
      };
    }

    if (!this.hasInstallSurfaceSupport()) {
      return {
        installability: 'unsupported',
        installMethod: 'none',
        blockedReason: 'missing-browser-support'
      };
    }

    if (!this.isEligibleInstallContext()) {
      return {
        installability: 'unsupported',
        installMethod: 'none',
        blockedReason: 'insecure-context'
      };
    }

    return {
      installability: 'available',
      installMethod: this.deferredPrompt ? 'prompt' : 'manual',
      blockedReason: null
    };
  };

  private hasDesktopHost = (): boolean => {
    return typeof window !== 'undefined' && Boolean(window.nextclawDesktop);
  };

  private hasInstallSurfaceSupport = (): boolean => {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && 'serviceWorker' in navigator;
  };

  private isEligibleInstallContext = (): boolean => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.isSecureContext || this.isTrustedLocalhost(window.location.hostname);
  };

  private isTrustedLocalhost = (hostname: string): boolean => {
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
  };

  private isDevelopmentServer = (): boolean => {
    return typeof window !== 'undefined' && import.meta.env.DEV && !import.meta.env.VITEST;
  };

  private isStandalone = (): boolean => {
    if (typeof window === 'undefined') {
      return false;
    }

    const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
    const matchesStandalone =
      typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
    return matchesStandalone || navigatorWithStandalone.standalone === true;
  };

  private bindDisplayModeListener = (query: MediaQueryList, listener: () => void) => {
    if ('addEventListener' in query) {
      query.addEventListener('change', listener);
      return;
    }
    const legacyQuery = query as MediaQueryList & {
      addListener?: (callback: (event: MediaQueryListEvent) => void) => void;
    };
    legacyQuery.addListener?.(listener);
  };

  private unbindDisplayModeListener = (query: MediaQueryList, listener: () => void) => {
    if ('removeEventListener' in query) {
      query.removeEventListener('change', listener);
      return;
    }
    const legacyQuery = query as MediaQueryList & {
      removeListener?: (callback: (event: MediaQueryListEvent) => void) => void;
    };
    legacyQuery.removeListener?.(listener);
  };

}

export const pwaInstallManager = new PwaInstallManager();
