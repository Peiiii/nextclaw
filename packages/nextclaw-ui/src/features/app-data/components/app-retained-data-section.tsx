import { useEffect, useRef, useState } from 'react';
import type { AppDataEntry } from '@nextclaw/client-sdk';
import { AlertCircle, Archive, LoaderCircle, Trash2 } from 'lucide-react';
import { AppStorageUsageDetails } from './app-storage-usage';
import { useDeleteRetainedAppData } from '@/features/app-data/hooks/use-app-data';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { t } from '@/shared/lib/i18n';

export function AppRetainedDataSection({
  diagnostics,
  entries,
  error,
  isLoading,
  onDeletionFocusReturn,
}: {
  diagnostics: Array<{ instanceDirectory: string; message: string }>;
  entries: AppDataEntry[];
  error: unknown;
  isLoading: boolean;
  onDeletionFocusReturn?: () => void;
}) {
  const [selected, setSelected] = useState<AppDataEntry | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const deletion = useDeleteRetainedAppData();
  const retained = entries.filter((entry) => entry.lifecycle === 'retained');
  const closeDialog = () => {
    if (!deletion.isPending) setSelected(null);
  };
  useEffect(() => {
    if (deletion.isError) errorRef.current?.focus();
  }, [deletion.isError]);
  if (!isLoading && !error && diagnostics.length === 0 && retained.length === 0) {
    return null;
  }
  return (
    <section className="mt-6" aria-labelledby="retained-app-data-title">
      <div className="mb-2.5 px-1">
        <h2
          ref={headingRef}
          id="retained-app-data-title"
          tabIndex={-1}
          className="text-sm font-semibold text-foreground"
        >
          {t('appDataRetainedTitle')}
        </h2>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          {t('appDataRetainedDescription')}
        </p>
      </div>
      {isLoading ? <Skeleton className="h-28 w-full rounded-xl" /> : null}
      {error ? (
        <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
          {error instanceof Error ? error.message : t('appDataLoadFailed')}
        </div>
      ) : null}
      {diagnostics.length > 0 ? (
        <div role="alert" className="mb-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-1.5 font-medium">
            <AlertCircle className="h-3.5 w-3.5" />
            {t('appDataDiagnosticsTitle')}
          </div>
          <ul className="mt-1 space-y-1">
            {diagnostics.map((entry) => (
              <li key={entry.instanceDirectory} className="break-all">
                {entry.message} — {entry.instanceDirectory}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="space-y-2.5">
        {retained.map((entry) => (
          <article key={entry.id} className="rounded-xl border border-border/65 bg-card p-3.5">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Archive className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{entry.displayName}</div>
                <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                  {entry.appId}{entry.publisherId ? ` · ${entry.publisherId}` : ''}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  deletion.reset();
                  setSelected(entry);
                }}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                {t('appDataDeleteAction')}
              </Button>
            </div>
            <div className="mt-3">
              <AppStorageUsageDetails storage={entry.storage} usage={entry.usage} />
            </div>
          </article>
        ))}
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent
          className="max-w-md [&>:last-child]:hidden"
          onEscapeKeyDown={(event) => deletion.isPending && event.preventDefault()}
          onInteractOutside={(event) => deletion.isPending && event.preventDefault()}
        >
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>{t('appDataDeleteTitle')}</DialogTitle>
                <DialogDescription>{t('appDataDeleteDescription')}</DialogDescription>
              </DialogHeader>
              <div className="mt-4 space-y-3">
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {selected.displayName} · {selected.appId}
                </div>
                <AppStorageUsageDetails storage={selected.storage} usage={selected.usage} />
                {deletion.isError ? (
                  <p
                    ref={errorRef}
                    role="alert"
                    tabIndex={-1}
                    className="text-xs text-destructive"
                  >
                    {deletion.error instanceof Error ? deletion.error.message : t('appDataDeleteFailed')}
                  </p>
                ) : null}
              </div>
              <DialogFooter className="mt-5 gap-2 sm:gap-0">
                <Button
                  autoFocus
                  type="button"
                  variant="outline"
                  disabled={deletion.isPending}
                  onClick={closeDialog}
                >
                  {t('cancel')}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deletion.isPending}
                  onClick={() => deletion.mutate({
                    dataId: selected.id,
                    confirmAppId: selected.appId,
                  }, {
                    onSuccess: () => {
                      setSelected(null);
                      window.requestAnimationFrame(() => {
                        if (headingRef.current) headingRef.current.focus();
                        else onDeletionFocusReturn?.();
                      });
                    },
                  })}
                >
                  {deletion.isPending ? <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                  {deletion.isPending ? t('appDataDeleting') : t('appDataDeletePermanently')}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
