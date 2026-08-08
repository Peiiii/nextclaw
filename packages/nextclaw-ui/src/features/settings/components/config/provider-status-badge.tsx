import { StatusDot } from '@/shared/components/status/status-dot';
import { t } from '@/shared/lib/i18n';

type ProviderStatusBadgeProps = {
  enabled: boolean;
  apiKeyRequired?: boolean;
  apiKeySet: boolean;
  className?: string;
};

export function ProviderStatusBadge({ apiKeyRequired = true, apiKeySet, className, enabled }: ProviderStatusBadgeProps) {
  if (!enabled) {
    return <StatusDot status="inactive" label={t('disabled')} className={className} />;
  }
  const isReady = !apiKeyRequired || apiKeySet;
  return <StatusDot status={isReady ? 'ready' : 'setup'} label={isReady ? t('statusReady') : t('statusSetup')} className={className} />;
}
