import { pwaInstallManager } from '@/pwa/managers/pwa-install.manager';
import { pwaRuntimeManager } from '@/pwa/managers/pwa-runtime.manager';

let pwaStarted = false;

export function startNextClawPwa() {
  if (pwaStarted || typeof window === 'undefined') {
    return;
  }

  pwaStarted = true;
  pwaInstallManager.start();
  void pwaRuntimeManager.start();
}
