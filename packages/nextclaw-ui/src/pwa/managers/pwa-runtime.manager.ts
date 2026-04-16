import { usePwaStore } from '@/pwa/stores/pwa.store';

export class PwaRuntimeManager {
  private started = false;
  private registration: ServiceWorkerRegistration | null = null;
  private reloadWhenControllerChanges = false;

  start = async () => {
    if (this.started || typeof window === 'undefined') {
      return;
    }

    this.started = true;
    if (!('serviceWorker' in navigator) || !this.isEligibleInstallContext()) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      this.registration = registration;
      this.bindRegistration(registration);
      navigator.serviceWorker.addEventListener('controllerchange', this.handleControllerChange);
      await this.syncUpdateAvailability();
    } catch {
      usePwaStore.setState({
        registrationFailed: true
      });
    }
  };

  syncUpdateAvailability = async () => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      typeof navigator.serviceWorker.getRegistration !== 'function'
    ) {
      usePwaStore.setState({
        updateAvailable: false
      });
      return;
    }

    const registration = this.registration ?? (await navigator.serviceWorker.getRegistration('/sw.js')) ?? null;
    usePwaStore.setState({
      updateAvailable: this.shouldSurfaceUpdate(registration)
    });
  };

  applyUpdate = async () => {
    const registration = this.registration ?? (await navigator.serviceWorker.getRegistration('/sw.js')) ?? null;
    if (!registration) {
      window.location.reload();
      return;
    }

    if (!registration.waiting) {
      await registration.update();
    }

    const waitingWorker = registration.waiting;
    if (!waitingWorker) {
      window.location.reload();
      return;
    }

    this.reloadWhenControllerChanges = true;
    waitingWorker.postMessage({
      type: 'SKIP_WAIT'
    });
  };

  stop = () => {
    if (!this.started || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    navigator.serviceWorker.removeEventListener('controllerchange', this.handleControllerChange);
    this.started = false;
    this.registration = null;
    this.reloadWhenControllerChanges = false;
  };

  private bindRegistration = (registration: ServiceWorkerRegistration) => {
    registration.addEventListener('updatefound', () => {
      const installingWorker = registration.installing;
      if (!installingWorker) {
        return;
      }

      installingWorker.addEventListener('statechange', () => {
        if (installingWorker.state === 'installed') {
          void this.syncUpdateAvailability();
        }
      });
    });
  };

  private handleControllerChange = () => {
    if (!this.reloadWhenControllerChanges) {
      return;
    }

    this.reloadWhenControllerChanges = false;
    window.location.reload();
  };

  private isEligibleInstallContext = (): boolean => {
    return window.isSecureContext || this.isTrustedLocalhost(window.location.hostname);
  };

  private isTrustedLocalhost = (hostname: string): boolean => {
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
  };

  private shouldSurfaceUpdate = (registration: ServiceWorkerRegistration | null): boolean => {
    if (!registration?.waiting || !navigator.serviceWorker.controller) {
      return false;
    }
    return usePwaStore.getState().installability === 'installed';
  };
}

export const pwaRuntimeManager = new PwaRuntimeManager();
