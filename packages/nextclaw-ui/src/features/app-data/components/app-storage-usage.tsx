import type { AppDataEntry } from '@nextclaw/client-sdk';
import { HardDrive } from 'lucide-react';
import { t } from '@/shared/lib/i18n';

type Storage = AppDataEntry['storage'];
type Usage = AppDataEntry['usage'];

export function AppStorageUsageDetails({
  storage,
  usage,
}: {
  storage: Storage;
  usage: Usage;
}) {
  const rows = [
    [t('appDataClassData'), usage.dataBytes],
    [t('appDataClassConfig'), usage.configBytes],
    [t('appDataClassState'), usage.stateBytes],
    [t('appDataClassCache'), usage.cacheBytes],
    [t('appDataClassTemporary'), usage.temporaryBytes],
    [t('appDataClassLogs'), usage.logsBytes],
  ] as const;
  return (
    <div className="rounded-xl bg-muted/45 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
          <HardDrive className="h-3.5 w-3.5" />
          {t('appDataStorageTotal')}
        </span>
        <span className="tabular-nums text-foreground">{formatBytes(usage.totalBytes)}</span>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-3">
        {rows.map(([label, bytes]) => (
          <div key={label} className="flex min-w-0 items-center justify-between gap-2">
            <dt className="truncate text-muted-foreground">{label}</dt>
            <dd className="shrink-0 tabular-nums text-foreground/80">{formatBytes(bytes)}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-2 border-t border-border/50 pt-2">
        <div className="text-[10px] text-muted-foreground">{t('appDataStoragePath')}</div>
        <code
          aria-label={t('appDataStoragePath')}
          className="mt-0.5 block select-all break-all font-mono text-[10px] leading-4 text-foreground/75"
          tabIndex={0}
        >
          {storage.instanceDirectory}
        </code>
      </div>
    </div>
  );
}

export function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
