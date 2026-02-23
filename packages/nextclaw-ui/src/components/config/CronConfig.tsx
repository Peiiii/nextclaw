import { useMemo, useState } from 'react';
import type { CronJobView } from '@/api/types';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useCronJobs, useDeleteCronJob, useToggleCronJob, useRunCronJob } from '@/hooks/useConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';
import { AlarmClock, RefreshCw, Trash2, Play, Power } from 'lucide-react';

type StatusFilter = 'all' | 'enabled' | 'disabled';

function formatDate(value?: string | null): string {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function formatDateFromMs(value?: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return date.toLocaleString();
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
    <div className="h-[calc(100vh-80px)] w-full max-w-[1200px] mx-auto animate-fade-in flex flex-col pt-6 pb-2">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{t('cronPageTitle')}</h2>
          <p className="text-sm text-gray-500 mt-1">{t('cronPageDescription')}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          onClick={() => cronQuery.refetch()}
        >
          <RefreshCw className={cn('h-4 w-4', cronQuery.isFetching && 'animate-spin')} />
        </Button>
      </div>

      <Card hover={false} className="mb-6">
        <CardContent className="pt-6">
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
        </CardContent>
      </Card>

      <div className="flex-1 overflow-auto custom-scrollbar">
        {cronQuery.isLoading ? (
          <div className="text-sm text-gray-400 p-4 text-center">{t('cronLoading')}</div>
        ) : jobs.length === 0 ? (
          <div className="text-sm text-gray-400 p-4 text-center">{t('cronEmpty')}</div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <Card key={job.id} className="border border-gray-200">
                <CardContent className="pt-5 pb-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-[220px] flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">
                          {job.name || job.id}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          {job.id}
                        </span>
                        <span
                          className={cn(
                            'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                            job.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                          )}
                        >
                          {job.enabled ? t('enabled') : t('disabled')}
                        </span>
                        {job.deleteAfterRun && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                            {t('cronOneShot')}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        {t('cronScheduleLabel')}: {describeSchedule(job)}
                      </div>
                      <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap break-words">
                        {job.payload.message}
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        {t('cronDeliverTo')}: {describeDelivery(job)}
                      </div>
                    </div>
                    <div className="min-w-[220px] text-xs text-gray-500 space-y-2">
                      <div>
                        <span className="font-medium text-gray-700">{t('cronNextRun')}:</span>{' '}
                        {formatDate(job.state.nextRunAt)}
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">{t('cronLastRun')}:</span>{' '}
                        {formatDate(job.state.lastRunAt)}
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">{t('cronLastStatus')}:</span>{' '}
                        {job.state.lastStatus ?? '-'}
                      </div>
                      {job.state.lastError && (
                        <div className="text-[11px] text-red-500 break-words">
                          {job.state.lastError}
                        </div>
                      )}
                    </div>
                    <div className="flex items-start gap-2 flex-wrap justify-end">
                      <Button
                        variant="subtle"
                        size="sm"
                        onClick={() => handleRun(job)}
                        className="gap-1"
                      >
                        <Play className="h-3.5 w-3.5" />
                        {t('cronRunNow')}
                      </Button>
                      <Button
                        variant={job.enabled ? 'outline' : 'primary'}
                        size="sm"
                        onClick={() => handleToggle(job)}
                        className="gap-1"
                      >
                        <Power className="h-3.5 w-3.5" />
                        {job.enabled ? t('cronDisable') : t('cronEnable')}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(job)}
                        className="gap-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t('delete')}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      <ConfirmDialog />
    </div>
  );
}
