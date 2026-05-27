import { ArrowLeft, RefreshCw } from 'lucide-react';
import { t } from '@/shared/lib/i18n';

type PanelAppToolbarProps = {
  onOpenApps: () => void;
  onRefresh: () => void;
};

export function PanelAppToolbar({
  onOpenApps,
  onRefresh,
}: PanelAppToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-2 px-3.5 py-2 bg-white border-b border-gray-100 shrink-0">
      <button
        type="button"
        onClick={onOpenApps}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t('appsTitle')}
      </button>
      <button
        type="button"
        onClick={onRefresh}
        className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
        title={t('panelAppsRefreshCurrent')}
        aria-label={t('panelAppsRefreshCurrent')}
      >
        <RefreshCw className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
