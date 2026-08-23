import { Activity, Eye, Inbox, Puzzle, RefreshCw } from 'lucide-react';
import { SettingsPage } from '@/shared/components/settings/settings-page';
import { Button } from '@/shared/components/ui/button';
import { useExtensions } from '@/features/extensions/hooks/use-extensions';
import { t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/utils';
import type { UiExtensionView } from '@/shared/lib/api';

const stateStyles: Record<UiExtensionView['state'], string> = {
  running: 'bg-emerald-50 text-emerald-700',
  starting: 'bg-amber-50 text-amber-700',
  stopping: 'bg-amber-50 text-amber-700',
  stopped: 'bg-muted text-muted-foreground',
  failed: 'bg-rose-50 text-rose-700',
};

function ExtensionState({ state }: { state: UiExtensionView['state'] }) {
  return (
    <span className={cn('rounded-full px-2 py-1 text-xs font-medium', stateStyles[state])}>
      {t(`extensionsState${state[0].toUpperCase()}${state.slice(1)}`)}
    </span>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className='rounded-xl border border-border/70 bg-card px-4 py-3'>
      <div className='text-xs text-muted-foreground'>{label}</div>
      <div className='mt-1 text-2xl font-semibold tabular-nums text-foreground'>{value}</div>
    </div>
  );
}

function ExtensionCard({ extension }: { extension: UiExtensionView }) {
  return (
    <article className='rounded-xl border border-border/70 bg-card p-4'>
      <div className='flex items-start gap-3'>
        <span className='inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary'>
          <Puzzle className='h-5 w-5' />
        </span>
        <div className='min-w-0 flex-1'>
          <div className='flex flex-wrap items-center gap-2'>
            <h2 className='truncate font-semibold text-foreground'>{extension.name}</h2>
            <ExtensionState state={extension.state} />
          </div>
          <p className='mt-1 break-all text-xs text-muted-foreground'>
            {extension.id}{extension.version ? ` · v${extension.version}` : ''}
          </p>
        </div>
      </div>
      <div className='mt-4 grid gap-2 sm:grid-cols-2'>
        <div className='rounded-lg bg-muted/40 px-3 py-2'>
          <div className='flex items-center gap-1.5 text-xs font-medium text-foreground'>
            <Eye className='h-3.5 w-3.5' />
            {t('extensionsObservationCapabilities')}
          </div>
          <div className='mt-1 text-xs text-muted-foreground'>
            {extension.observations.context ? t('extensionsContextCapability') : null}
            {extension.observations.context && extension.observations.events ? ' · ' : null}
            {extension.observations.events ? t('extensionsEventsCapability') : null}
            {!extension.observations.context && !extension.observations.events ? t('extensionsNone') : null}
          </div>
        </div>
        <div className='rounded-lg bg-muted/40 px-3 py-2'>
          <div className='flex items-center gap-1.5 text-xs font-medium text-foreground'>
            <Inbox className='h-3.5 w-3.5' />
            {t('extensionsChannelCapabilities')}
          </div>
          <div className='mt-1 text-xs text-muted-foreground'>
            {extension.channels.length > 0
              ? extension.channels.map((channel) => channel.name || channel.id).join(' · ')
              : t('extensionsNone')}
          </div>
        </div>
      </div>
      <div className='mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground'>
        <span>{t('extensionsLeaseCount')}: {extension.leaseCount}</span>
        {extension.pid ? <span>{t('extensionsProcess')}: {extension.pid}</span> : null}
        {extension.startedAt ? <span>{t('extensionsStartedAt')}: {new Date(extension.startedAt).toLocaleString()}</span> : null}
      </div>
    </article>
  );
}

export function ExtensionsConfigPage() {
  const query = useExtensions();
  const view = query.data;

  return (
    <SettingsPage
      title={t('extensionsPageTitle')}
      description={t('extensionsPageDescription')}
      actions={(
        <Button type='button' variant='outline' size='sm' disabled={query.isFetching} onClick={() => void query.refetch()}>
          <RefreshCw className={cn('mr-2 h-4 w-4', query.isFetching && 'animate-spin')} />
          {t('extensionsRefresh')}
        </Button>
      )}
    >
      <div className='rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground'>
        <div className='flex items-start gap-2'>
          <Activity className='mt-0.5 h-4 w-4 shrink-0 text-primary' />
          <p>{t('extensionsLifecycleDescription')}</p>
        </div>
      </div>
      {query.isPending ? (
        <div className='text-sm text-muted-foreground'>{t('extensionsLoading')}</div>
      ) : query.isError ? (
        <div className='rounded-xl border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-700'>
          <p>{t('extensionsLoadFailed')}</p>
          <Button className='mt-3' type='button' variant='outline' size='sm' onClick={() => void query.refetch()}>
            {t('extensionsRetry')}
          </Button>
        </div>
      ) : view?.extensions.length ? (
        <>
          <div className='grid grid-cols-2 gap-2 lg:grid-cols-4'>
            <SummaryCard label={t('extensionsTotal')} value={view.counts.total} />
            <SummaryCard label={t('extensionsRunning')} value={view.counts.running} />
            <SummaryCard label={t('extensionsWithObservations')} value={view.counts.withObservations} />
            <SummaryCard label={t('extensionsWithChannels')} value={view.counts.withChannels} />
          </div>
          <div className='space-y-3'>
            {view.extensions.map((extension) => <ExtensionCard key={extension.id} extension={extension} />)}
          </div>
        </>
      ) : (
        <div className='rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground'>
          <Puzzle className='mx-auto h-5 w-5 text-muted-foreground/50' />
          <p className='mt-2 font-medium text-foreground'>{t('extensionsEmpty')}</p>
          <p className='mt-1'>{t('extensionsEmptyDescription')}</p>
        </div>
      )}
    </SettingsPage>
  );
}
