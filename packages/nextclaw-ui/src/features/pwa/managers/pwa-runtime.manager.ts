export class PwaRuntimeManager {
  private started = false;
  private registration: ServiceWorkerRegistration | null = null;

  start = async () => {
    if (this.started || typeof window === 'undefined') {
      return;
    }

    this.started = true;
    if (!('serviceWorker' in navigator) || !this.isEligibleInstallContext()) {
      return;
    }

    if (this.isDevelopmentServer()) {
      await this.cleanupDevelopmentRegistrations();
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      this.registration = registration;
    } catch {
      return;
    }
  };

  stop = () => {
    if (!this.started || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    this.started = false;
    this.registration = null;
  };

  private isEligibleInstallContext = (): boolean => {
    return window.isSecureContext || this.isTrustedLocalhost(window.location.hostname);
  };

  private isTrustedLocalhost = (hostname: string): boolean => {
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
  };

  private isDevelopmentServer = (): boolean => {
    return import.meta.env.DEV && !import.meta.env.VITEST;
  };

  private cleanupDevelopmentRegistrations = async () => {
    if (typeof navigator.serviceWorker.getRegistrations !== 'function') {
      return;
    }

    const registrations = await navigator.serviceWorker.getRegistrations();
    const nextclawRegistrations = registrations.filter((registration) =>
      [registration.active?.scriptURL, registration.installing?.scriptURL, registration.waiting?.scriptURL]
        .filter((value): value is string => Boolean(value))
        .some((scriptUrl) => scriptUrl.endsWith('/sw.js'))
    );

    await Promise.all(nextclawRegistrations.map(async (registration) => await registration.unregister()));
    if (nextclawRegistrations.length > 0) {
      await this.clearNextClawCaches();
    }
  };

  private clearNextClawCaches = async () => {
    if (typeof window === 'undefined' || !('caches' in window) || typeof caches.keys !== 'function') {
      return;
    }

    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('nextclaw-ui-')).map(async (key) => await caches.delete(key)));
  };

}

export const pwaRuntimeManager = new PwaRuntimeManager();
