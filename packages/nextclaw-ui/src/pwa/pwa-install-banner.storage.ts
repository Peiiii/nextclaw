export const PWA_INSTALL_BANNER_DISMISS_STORAGE_KEY = 'nextclaw-pwa-install-banner-dismissed-until';
export const PWA_INSTALL_BANNER_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

export function isPwaInstallBannerDismissed(): boolean {
  const dismissedUntil = readPwaInstallBannerDismissedUntil();
  if (!dismissedUntil) {
    return false;
  }

  if (dismissedUntil <= Date.now()) {
    clearPwaInstallBannerDismissal();
    return false;
  }

  return true;
}

export function dismissPwaInstallBannerUntil(dismissedUntil: number) {
  const storage = getPwaBannerStorage();
  storage?.setItem(PWA_INSTALL_BANNER_DISMISS_STORAGE_KEY, String(dismissedUntil));
}

export function clearPwaInstallBannerDismissal() {
  const storage = getPwaBannerStorage();
  storage?.removeItem(PWA_INSTALL_BANNER_DISMISS_STORAGE_KEY);
}

export function readPwaInstallBannerDismissedUntil(): number | null {
  const storage = getPwaBannerStorage();
  if (!storage) {
    return null;
  }

  const rawValue = storage.getItem(PWA_INSTALL_BANNER_DISMISS_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getPwaBannerStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
