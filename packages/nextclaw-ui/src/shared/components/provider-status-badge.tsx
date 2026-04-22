import { StatusDot } from '@/shared/components/ui/status-dot';
import { t } from '@/shared/lib/i18n';

type ProviderStatusBadgeProps = {
  enabled: boolean;
  apiKeySet: boolean;
  className?: string;
};

export function ProviderStatusBadge(props: ProviderStatusBadgeProps) {
  if (!props.enabled) {
    return <StatusDot status="inactive" label={t('disabled')} className={props.className} />;
  }
  return <StatusDot status={props.apiKeySet ? 'ready' : 'setup'} label={props.apiKeySet ? t('statusReady') : t('statusSetup')} className={props.className} />;
}
