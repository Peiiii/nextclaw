import { StatusDot } from '@/shared/components/status/status-dot';
import { t } from '@/shared/lib/i18n';

type ProviderStatusBadgeProps = {
  enabled: boolean;
  apiKeySet: boolean;
  className?: string;
};

export function ProviderStatusBadge({ apiKeySet, className, enabled }: ProviderStatusBadgeProps) {
  if (!enabled) {
    return <StatusDot status="inactive" label={t('disabled')} className={className} />;
  }
  return <StatusDot status={apiKeySet ? 'ready' : 'setup'} label={apiKeySet ? t('statusReady') : t('statusSetup')} className={className} />;
}
