export const PWA_INSTALL_BANNER_DISMISS_STORAGE_KEY = 'nextclaw-pwa-install-banner-dismissed';
export const PWA_INSTALL_BANNER_LEGACY_UNTIL_STORAGE_KEY = 'nextclaw-pwa-install-banner-dismissed-until';

export function isPwaInstallBannerDismissed(): boolean {
  const storage = getPwaBannerStorage();
  if (!storage) {
    return false;
  }

  if (storage.getItem(PWA_INSTALL_BANNER_DISMISS_STORAGE_KEY) === '1') {
    return true;
  }

  return migrateLegacyDismissal(storage);
}

export function dismissPwaInstallBanner() {
  const storage = getPwaBannerStorage();
  storage?.setItem(PWA_INSTALL_BANNER_DISMISS_STORAGE_KEY, '1');
  storage?.removeItem(PWA_INSTALL_BANNER_LEGACY_UNTIL_STORAGE_KEY);
}

export function clearPwaInstallBannerDismissal() {
  const storage = getPwaBannerStorage();
  storage?.removeItem(PWA_INSTALL_BANNER_DISMISS_STORAGE_KEY);
  storage?.removeItem(PWA_INSTALL_BANNER_LEGACY_UNTIL_STORAGE_KEY);
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

function migrateLegacyDismissal(storage: Storage): boolean {
  const rawValue = storage.getItem(PWA_INSTALL_BANNER_LEGACY_UNTIL_STORAGE_KEY);
  if (!rawValue) {
    return false;
  }

  const dismissedUntil = Number.parseInt(rawValue, 10);
  storage.removeItem(PWA_INSTALL_BANNER_LEGACY_UNTIL_STORAGE_KEY);
  if (!Number.isFinite(dismissedUntil) || dismissedUntil <= Date.now()) {
    return false;
  }

  storage.setItem(PWA_INSTALL_BANNER_DISMISS_STORAGE_KEY, '1');
  return true;
}
