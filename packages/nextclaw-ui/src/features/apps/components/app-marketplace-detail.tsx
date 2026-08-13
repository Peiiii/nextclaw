import type { AppPackageOperationView, AppPackageView } from '@nextclaw/client-sdk';
import { ExternalLink, FileText, Server, ShieldAlert, ShieldCheck, type LucideIcon } from 'lucide-react';
import { AppArtwork } from '@/features/apps/components/app-artwork';
import { AppMarketplaceCover } from '@/features/apps/components/app-marketplace-cover';
import {
  MarketplaceInstallButton,
  OperationProgress,
} from '@/features/apps/components/app-marketplace-operation';
import { isAppPackageOperationActive } from '@/features/apps/hooks/use-app-packages';
import type { AppMarketplaceDetailView } from '@/features/apps/types/app-marketplace.types';
import { pickLocalizedText } from '@/features/marketplace';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { t } from '@/shared/lib/i18n';

export function MarketplaceDetail({
  detail,
  error,
  installedPackage,
  isLoading,
  isStarting,
  localeFallbacks,
  onInstall,
  onUpdate,
  operation,
}: {
  detail?: AppMarketplaceDetailView;
  error: Error | null;
  installedPackage?: AppPackageView;
  isLoading: boolean;
  isStarting: boolean;
  localeFallbacks: string[];
  onInstall: (source: string, registryUrl: string) => void;
  onUpdate: (appId: string) => void;
  operation?: AppPackageOperationView;
}) {
  if (isLoading) {
    return <div className="space-y-4 p-6"><Skeleton className="h-24 w-full rounded-2xl" /><Skeleton className="h-40 w-full rounded-2xl" /></div>;
  }
  if (error || !detail) {
    return <div role="alert" className="m-6 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-5 text-sm text-destructive">{error?.message ?? t('appPackagesMarketplaceFailed')}</div>;
  }
  const summary = pickLocalizedText(detail.summaryI18n, detail.summary, localeFallbacks);
  const description = pickLocalizedText(detail.descriptionI18n, detail.description ?? summary, localeFallbacks);
  const active = operation ? isAppPackageOperationActive(operation.status) : false;
  const failed = operation?.status === 'failed' || operation?.status === 'interrupted';
  const components = detail.manifest.components ?? [];
  const panelCount = components.filter((entry) => entry.kind === 'panel').length;
  const serviceCount = components.filter((entry) => entry.kind === 'service').length;
  const runtimeProfile = detail.manifest.runtime?.profile
    ?? (serviceCount > 0 ? 'native-process' : 'panel-only');
  const canUpdate = Boolean(
    installedPackage && installedPackage.activeVersion !== detail.latestVersion,
  );
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-5 sm:px-7 sm:py-6">
      <div className="grid items-stretch gap-5 sm:grid-cols-[minmax(0,1.18fr)_minmax(240px,0.82fr)]">
        <AppMarketplaceCover accentColor={detail.accentColor} coverPreview={detail.coverPreview} coverUrl={detail.coverUrl} name={detail.name} className="aspect-[16/9] rounded-2xl" />
        <div className="flex min-w-0 flex-col rounded-2xl border border-border/60 bg-card p-4">
          <div className="flex items-start gap-3">
            <AppArtwork icon={detail.iconUrl ?? installedPackage?.icon} name={detail.name} className="h-14 w-14 rounded-2xl" />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">{detail.name}</h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" />{detail.publisher.name}</span>
                <span>v{detail.latestVersion}</span>
              </div>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{summary}</p>
          <div className="mt-auto pt-4">
            <MarketplaceInstallButton
              active={active}
              canUpdate={canUpdate}
              failed={failed}
              installed={Boolean(installedPackage)}
              isStarting={isStarting}
              onAction={() => canUpdate
                ? onUpdate(detail.appId)
                : onInstall(detail.install.spec, detail.install.registry)}
              operation={operation}
            />
          </div>
        </div>
      </div>
      {operation && (active || failed) ? <OperationProgress operation={operation} /> : null}

      <section className="mt-7">
        <h3 className="text-sm font-semibold text-foreground">{t('appPackagesAboutApp')}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      </section>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <DetailFact icon={FileText} label={t('appPackagesPanelsAdded')} value={panelCount > 0 ? String(panelCount) : t('appPackagesNone')} />
        <DetailFact icon={Server} label={t('appPackagesServicesAdded')} value={serviceCount > 0 ? String(serviceCount) : t('appPackagesNone')} />
        {detail.manifest.engines?.nextclaw ? (
          <DetailFact
            icon={ShieldCheck}
            label={t('appPackagesNextClawRequirement')}
            value={detail.manifest.engines.nextclaw}
          />
        ) : null}
        <DetailFact
          icon={runtimeProfile === 'native-process' ? ShieldAlert : ShieldCheck}
          label={t('appPackagesIsolationLabel')}
          value={runtimeProfile === 'native-process'
            ? t('appPackagesIsolationFullUser')
            : runtimeProfile === 'wasi'
              ? t('appPackagesIsolationMediated')
              : t('appPackagesIsolationPanel')}
        />
      </div>

      <section className="mt-7 border-t border-border/60 pt-6">
        <h3 className="text-sm font-semibold text-foreground">{t('appPackagesAccessTitle')}</h3>
        <div className="mt-3 space-y-2">
          {readPermissionRows(detail).map((entry) => (
            <div key={entry} className="flex items-start gap-2.5 rounded-xl bg-muted/45 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{entry}</span>
            </div>
          ))}
        </div>
      </section>

      <a
        href={detail.webUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-6 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
      >
        {t('appPackagesOpenPublicDetails')}
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

function DetailFact({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon className="h-4 w-4" /></span>
      <div><p className="text-[11px] text-muted-foreground">{label}</p><p className="text-sm font-medium text-foreground">{value}</p></div>
    </div>
  );
}

function readPermissionRows(detail: AppMarketplaceDetailView): string[] {
  const rows: string[] = [];
  const documentAccess = detail.permissions.documentAccess ?? [];
  if (documentAccess.length > 0) {
    rows.push(t('appPackagesDocumentAccess').replace('{count}', String(documentAccess.length)));
  }
  const domains = detail.permissions.allowedDomains ?? [];
  if (domains.length > 0) {
    rows.push(t('appPackagesNetworkAccess').replace('{count}', String(domains.length)));
  }
  if (detail.permissions.capabilities?.hostBridge) {
    rows.push(t('appPackagesHostBridgeAccess'));
  }
  if (detail.permissions.capabilities?.nativeProcess) {
    rows.push(t('appPackagesNativeProcessAccess'));
  }
  if (detail.permissions.storage === true || (
    typeof detail.permissions.storage === 'object' &&
    detail.permissions.storage?.namespace
  )) {
    rows.push(t('appPackagesLocalStorageAccess'));
  }
  return rows.length > 0 ? rows : [t('appPackagesNoExtraAccess')];
}
