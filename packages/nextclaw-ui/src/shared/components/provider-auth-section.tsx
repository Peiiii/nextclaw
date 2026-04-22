import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { t } from '@/shared/lib/i18n';
import type { ProviderSpecView } from '@/shared/lib/api';
import { ProviderPillSelector } from './provider-pill-selector';

type ProviderAuthSectionProps = { providerAuth: ProviderSpecView['auth']; providerAuthNote: string; providerAuthMethodOptions: Array<{ value: string; label: string }>; providerAuthMethodsCount: number; selectedAuthMethodHint: string; shouldUseAuthMethodPills: boolean; resolvedAuthMethodId: string; onAuthMethodChange: (value: string) => void; onStartProviderAuth: () => void; onImportProviderAuthFromCli: () => void; startPending: boolean; importPending: boolean; authSessionId: string | null; authStatusMessage: string };

export function ProviderAuthSection(props: ProviderAuthSectionProps) {
  const {
    providerAuth,
    providerAuthNote,
    providerAuthMethodOptions,
    providerAuthMethodsCount,
    selectedAuthMethodHint,
    shouldUseAuthMethodPills,
    resolvedAuthMethodId,
    onAuthMethodChange,
    onStartProviderAuth,
    onImportProviderAuthFromCli,
    startPending,
    importPending,
    authSessionId,
    authStatusMessage
  } = props;

  if (providerAuth?.kind !== 'device_code') return null;

  return (
    <div className="space-y-2 rounded-xl border border-primary/20 bg-primary-50/50 p-3">
      <Label className="text-sm font-medium text-gray-900">
        {providerAuth.displayName || t('providerAuthSectionTitle')}
      </Label>
      {providerAuthNote ? <p className="text-xs text-gray-600">{providerAuthNote}</p> : null}
      {providerAuthMethodsCount > 1 ? (
        <div className="space-y-2">
          <Label className="text-xs font-medium text-gray-700">{t('providerAuthMethodLabel')}</Label>
          {shouldUseAuthMethodPills ? (
            <ProviderPillSelector
              value={resolvedAuthMethodId}
              onChange={onAuthMethodChange}
              options={providerAuthMethodOptions}
            />
          ) : (
            <Select value={resolvedAuthMethodId} onValueChange={onAuthMethodChange}>
              <SelectTrigger className="h-8 rounded-lg bg-white">
                <SelectValue placeholder={t('providerAuthMethodPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {providerAuthMethodOptions.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {selectedAuthMethodHint ? <p className="text-xs text-gray-500">{selectedAuthMethodHint}</p> : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onStartProviderAuth}
          disabled={startPending || Boolean(authSessionId)}
        >
          {startPending
            ? t('providerAuthStarting')
            : authSessionId
              ? t('providerAuthAuthorizing')
              : t('providerAuthAuthorizeInBrowser')}
        </Button>
        {providerAuth.supportsCliImport ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onImportProviderAuthFromCli}
            disabled={importPending}
          >
            {importPending ? t('providerAuthImporting') : t('providerAuthImportFromCli')}
          </Button>
        ) : null}
        {authSessionId ? (
          <span className="text-xs text-gray-500">
            {t('providerAuthSessionLabel')}: {authSessionId.slice(0, 8)}…
          </span>
        ) : null}
      </div>
      {authStatusMessage ? <p className="text-xs text-gray-600">{authStatusMessage}</p> : null}
    </div>
  );
}
