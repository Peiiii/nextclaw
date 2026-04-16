import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePwaStore } from '@/pwa/stores/pwa.store';
import { pwaInstallManager } from '@/pwa/managers/pwa-install.manager';
import { pwaRuntimeManager } from '@/pwa/managers/pwa-runtime.manager';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Download, RefreshCw, Smartphone, X } from 'lucide-react';

function InstallStatusBadge() {
  const installability = usePwaStore((state) => state.installability);

  const badgeClassName =
    installability === 'installed'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : installability === 'available'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-gray-100 text-gray-600 border-gray-200';

  return (
    <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium', badgeClassName)}>
      {resolveInstallabilityLabel(installability)}
    </span>
  );
}

function resolveInstallabilityLabel(installability: string): string {
  if (installability === 'available') {
    return t('pwaInstallStatusAvailable');
  }
  if (installability === 'installed') {
    return t('pwaInstallStatusInstalled');
  }
  if (installability === 'suppressed') {
    return t('pwaInstallStatusDesktopHost');
  }
  return t('pwaInstallStatusUnavailable');
}

function resolveCardDescription(
  installability: string,
  installMethod: string,
  blockedReason: string | null
) {
  if (installability === 'installed') {
    return t('pwaInstallCardInstalled');
  }

  if (installability === 'suppressed') {
    return t('pwaInstallCardSuppressed');
  }

  if (installability === 'available' && installMethod === 'prompt') {
    return t('pwaInstallCardPrompt');
  }

  if (installability === 'available') {
    return t('pwaInstallCardManual');
  }

  if (blockedReason === 'insecure-context') {
    return t('pwaInstallCardInsecureContext');
  }

  return t('pwaInstallCardUnsupported');
}

export function PwaInstallCard() {
  const installability = usePwaStore((state) => state.installability);
  const installMethod = usePwaStore((state) => state.installMethod);
  const blockedReason = usePwaStore((state) => state.blockedReason);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-2">
          <CardTitle>{t('pwaInstallTitle')}</CardTitle>
          <CardDescription>{t('pwaInstallDescription')}</CardDescription>
        </div>
        <InstallStatusBadge />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-gray-50/90 p-4">
          <p className="text-sm leading-6 text-gray-700">
            {resolveCardDescription(installability, installMethod, blockedReason)}
          </p>
        </div>

        {installability === 'available' && installMethod === 'prompt' ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              className="gap-2"
              onClick={() => {
                void pwaInstallManager.promptInstall();
              }}
            >
              <Download className="h-4 w-4" />
              {t('pwaInstallAction')}
            </Button>
            <p className="text-sm text-gray-500">{t('pwaInstallPromptHint')}</p>
          </div>
        ) : null}

        {installability === 'available' && installMethod === 'manual' ? (
          <div className="flex items-start gap-3 rounded-2xl border border-dashed border-gray-300 bg-white p-4">
            <Smartphone className="mt-0.5 h-4 w-4 text-gray-500" />
            <p className="text-sm leading-6 text-gray-600">{t('pwaInstallManualHint')}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function PwaInstallBanner() {
  const installability = usePwaStore((state) => state.installability);
  const installMethod = usePwaStore((state) => state.installMethod);
  const dismissedInstallPrompt = usePwaStore((state) => state.dismissedInstallPrompt);

  if (installability !== 'available' || installMethod !== 'prompt' || dismissedInstallPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 w-[min(420px,calc(100vw-2rem))] rounded-[26px] border border-gray-200 bg-white/95 p-5 shadow-2xl backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-900">{t('pwaInstallBannerTitle')}</p>
          <p className="text-sm leading-6 text-gray-600">{t('pwaInstallBannerDescription')}</p>
        </div>
        <button
          type="button"
          aria-label={t('pwaInstallDismiss')}
          className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          onClick={() => {
            pwaInstallManager.dismissInstallPrompt();
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button
          type="button"
          size="sm"
          className="gap-2"
          onClick={() => {
            void pwaInstallManager.promptInstall();
          }}
        >
          <Download className="h-4 w-4" />
          {t('pwaInstallAction')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            pwaInstallManager.dismissInstallPrompt();
          }}
        >
          {t('pwaInstallDismiss')}
        </Button>
      </div>
    </div>
  );
}

export function PwaUpdateBanner() {
  const updateAvailable = usePwaStore((state) => state.updateAvailable);
  const installability = usePwaStore((state) => state.installability);

  if (!updateAvailable || installability !== 'installed') {
    return null;
  }

  return (
    <div className="fixed top-5 right-5 z-50 w-[min(420px,calc(100vw-2rem))] rounded-[26px] border border-gray-200 bg-white/95 p-5 shadow-2xl backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-900">{t('pwaUpdateBannerTitle')}</p>
          <p className="text-sm leading-6 text-gray-600">{t('pwaUpdateBannerDescription')}</p>
        </div>
      </div>
      <div className="mt-4">
        <Button
          type="button"
          size="sm"
          className="gap-2"
          onClick={() => {
            void pwaRuntimeManager.applyUpdate();
          }}
        >
          <RefreshCw className="h-4 w-4" />
          {t('pwaUpdateAction')}
        </Button>
      </div>
    </div>
  );
}
