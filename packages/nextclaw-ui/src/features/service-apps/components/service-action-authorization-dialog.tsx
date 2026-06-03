import { ShieldAlert } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { t } from '@/shared/lib/i18n';
import { useServiceActionAuthorizationStore } from '@/features/service-apps/stores/service-action-authorization.store';

export function ServiceActionAuthorizationDialog() {
  const pending = useServiceActionAuthorizationStore((state) => state.pending);
  const resolveAuthorization = useServiceActionAuthorizationStore(
    (state) => state.resolveAuthorization,
  );

  return (
    <Dialog
      open={Boolean(pending)}
      onOpenChange={(open) => {
        if (!open) {
          resolveAuthorization(false);
        }
      }}
    >
      <DialogContent className="[&>:last-child]:hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            {t('serviceActionAuthorizationTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('serviceActionAuthorizationDescription')}
          </DialogDescription>
        </DialogHeader>
        {pending ? (
          <div className="space-y-3 rounded-md border border-gray-100 bg-gray-50 p-3 text-sm">
            <AuthorizationField label={t('serviceActionAuthorizationSource')} value={pending.panelAppId} />
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-500">
                {t('serviceActionAuthorizationActions')}
              </div>
              <div className="max-h-64 space-y-2 overflow-auto">
                {pending.actions.map((action) => (
                  <AuthorizationActionItem key={action.actionId} action={action} />
                ))}
              </div>
            </div>
            {pending.inputPreview ? (
              <AuthorizationField label={t('serviceActionAuthorizationInput')} value={pending.inputPreview} />
            ) : null}
          </div>
        ) : null}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => resolveAuthorization(false)}>
            {t('serviceActionAuthorizationReject')}
          </Button>
          <Button type="button" onClick={() => resolveAuthorization(true)}>
            {t('serviceActionAuthorizationAllow')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AuthorizationActionItem({
  action,
}: {
  action: {
    actionId: string;
    actionTitle?: string;
    actionDescription?: string;
    risk?: string;
  };
}) {
  return (
    <div className="space-y-1 rounded border border-gray-200 bg-white px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 break-words text-xs font-medium text-gray-900">
          {action.actionTitle ?? action.actionId}
        </div>
        <div className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
          {action.risk ?? 'dangerous'}
        </div>
      </div>
      <div className="break-words text-[11px] text-gray-500">{action.actionId}</div>
      {action.actionDescription ? (
        <div className="break-words text-xs text-gray-600">{action.actionDescription}</div>
      ) : null}
    </div>
  );
}

function AuthorizationField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="min-w-0 break-words text-xs text-gray-900">{value}</div>
    </div>
  );
}
