import { useMemo, useState } from 'react';
import type { CronJobView } from '@/shared/lib/api';
import { useConfirmDialog } from '@/shared/hooks/use-confirm-dialog';
import { useCronJobs, useDeleteCronJob, useToggleCronJob, useRunCronJob } from '@/shared/hooks/use-config';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Card, CardContent } from '@/shared/components/ui/card';
import { cn } from '@/shared/lib/utils';
import { formatDateTime, t } from '@/shared/lib/i18n';
import { PageLayout, PageHeader } from '@/app/components/layout/page-layout';
import { AlarmClock, RefreshCw, Trash2, Play, Power } from 'lucide-react';

type StatusFilter = 'all' | 'enabled' | 'disabled';

function formatDate(value?: string | null): string {
  return formatDateTime(value ?? undefined);
}

function formatDateFromMs(value?: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-';
  }
  return formatDateTime(new Date(value));
}

function formatEveryDuration(ms?: number | null): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) {
    return '-';
  }
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

function describeSchedule(job: CronJobView): string {
  const schedule = job.schedule;
  if (schedule.kind === 'cron') {
    return schedule.expr ? `cron ${schedule.expr}` : 'cron';
  }
  if (schedule.kind === 'every') {
    return `every ${formatEveryDuration(schedule.everyMs)}`;
  }
  if (schedule.kind === 'at') {
    return `at ${formatDateFromMs(schedule.atMs)}`;
  }
  return '-';
}

function describeDelivery(job: CronJobView): string {
  if (!job.payload.deliver) {
    return '-';
  }
  const channel = job.payload.channel ?? '-';
  const target = job.payload.to ?? '-';
  return `${channel}:${target}`;
}

function matchQuery(job: CronJobView, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    job.id,
    job.name,
    job.payload.message,
    job.payload.channel ?? '',
    job.payload.to ?? ''
  ].join(' ').toLowerCase();
  return haystack.includes(q);
}

function filterByStatus(job: CronJobView, status: StatusFilter): boolean {
  if (status === 'all') return true;
  if (status === 'enabled') return job.enabled;
  return !job.enabled;
}

function CronJobCard(props: {
  job: CronJobView;
  onDelete: (job: CronJobView) => void;
  onRun: (job: CronJobView) => void;
  onToggle: (job: CronJobView) => void;
}) {
  const { job, onDelete, onRun, onToggle } = props;
  return (
    <Card className="border border-gray-200">
      <CardContent className="pt-5 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-[220px] flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">{job.name || job.id}</span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">{job.id}</span>
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', job.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500')}>
                {job.enabled ? t('enabled') : t('disabled')}
              </span>
              {job.deleteAfterRun ? (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">{t('cronOneShot')}</span>
              ) : null}
            </div>
            <div className="mt-2 text-xs text-gray-500">{t('cronScheduleLabel')}: {describeSchedule(job)}</div>
            <div className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-700">{job.payload.message}</div>
            <div className="mt-2 text-xs text-gray-500">{t('cronDeliverTo')}: {describeDelivery(job)}</div>
          </div>
          <div className="min-w-[220px] space-y-2 text-xs text-gray-500">
            <div><span className="font-medium text-gray-700">{t('cronNextRun')}:</span> {formatDate(job.state.nextRunAt)}</div>
            <div><span className="font-medium text-gray-700">{t('cronLastRun')}:</span> {formatDate(job.state.lastRunAt)}</div>
            <div><span className="font-medium text-gray-700">{t('cronLastStatus')}:</span> {job.state.lastStatus ?? '-'}</div>
            {job.state.lastError ? <div className="break-words text-[11px] text-red-500">{job.state.lastError}</div> : null}
          </div>
          <div className="flex flex-wrap items-start justify-end gap-2">
            <Button variant="subtle" size="sm" onClick={() => onRun(job)} className="gap-1">
              <Play className="h-3.5 w-3.5" />
              {t('cronRunNow')}
            </Button>
            <Button variant={job.enabled ? 'outline' : 'primary'} size="sm" onClick={() => onToggle(job)} className="gap-1">
              <Power className="h-3.5 w-3.5" />
              {job.enabled ? t('cronDisable') : t('cronEnable')}
            </Button>
            <Button variant="destructive" size="sm" onClick={() => onDelete(job)} className="gap-1">
              <Trash2 className="h-3.5 w-3.5" />
              {t('delete')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CronConfig() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const cronQuery = useCronJobs({ all: true });
  const deleteCronJob = useDeleteCronJob();
  const toggleCronJob = useToggleCronJob();
  const runCronJob = useRunCronJob();
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const jobs = useMemo(() => {
    const data = cronQuery.data?.jobs ?? [];
    return data
      .filter((job) => matchQuery(job, query))
      .filter((job) => filterByStatus(job, status));
  }, [cronQuery.data, query, status]);

  const handleDelete = async (job: CronJobView) => {
    const confirmed = await confirm({
      title: `${t('cronDeleteConfirm')}?`,
      description: job.name ? `${job.name} (${job.id})` : job.id,
      variant: 'destructive',
      confirmLabel: t('delete')
    });
    if (!confirmed) return;
    deleteCronJob.mutate({ id: job.id });
  };

  const handleToggle = async (job: CronJobView) => {
    const nextEnabled = !job.enabled;
    const confirmed = await confirm({
      title: nextEnabled ? `${t('cronEnableConfirm')}?` : `${t('cronDisableConfirm')}?`,
      description: job.name ? `${job.name} (${job.id})` : job.id,
      variant: nextEnabled ? 'default' : 'destructive',
      confirmLabel: nextEnabled ? t('cronEnable') : t('cronDisable')
    });
    if (!confirmed) return;
    toggleCronJob.mutate({ id: job.id, enabled: nextEnabled });
  };

  const handleRun = async (job: CronJobView) => {
    const force = !job.enabled;
    const confirmed = await confirm({
      title: force ? `${t('cronRunForceConfirm')}?` : `${t('cronRunConfirm')}?`,
      description: job.name ? `${job.name} (${job.id})` : job.id,
      confirmLabel: t('cronRunNow')
    });
    if (!confirmed) return;
    runCronJob.mutate({ id: job.id, force });
  };

  return (
    <PageLayout fullHeight>
      <PageHeader
        title={t('cronPageTitle')}
        description={t('cronPageDescription')}
        actions={
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
            onClick={() => cronQuery.refetch()}
          >
            <RefreshCw className={cn('h-4 w-4', cronQuery.isFetching && 'animate-spin')} />
          </Button>
        }
      />

      <div className="mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('cronSearchPlaceholder')}
              className="pl-9"
            />
            <AlarmClock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          </div>
          <div className="min-w-[180px]">
            <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('cronStatusLabel')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('cronStatusAll')}</SelectItem>
                <SelectItem value="enabled">{t('cronStatusEnabled')}</SelectItem>
                <SelectItem value="disabled">{t('cronStatusDisabled')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-xs text-gray-500 ml-auto">
            {t('cronTotalLabel')}: {cronQuery.data?.total ?? 0} / {jobs.length}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar">
        {cronQuery.isLoading ? (
          <div className="text-sm text-gray-400 p-4 text-center">{t('cronLoading')}</div>
        ) : jobs.length === 0 ? (
          <div className="text-sm text-gray-400 p-4 text-center">{t('cronEmpty')}</div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <CronJobCard key={job.id} job={job} onDelete={handleDelete} onRun={handleRun} onToggle={handleToggle} />
            ))}
          </div>
        )}
      </div>
      <ConfirmDialog />
    </PageLayout>
  );
}
