import { ArrowLeft, RefreshCw } from 'lucide-react';
import { t } from '@/shared/lib/i18n';

type PanelAppToolbarProps = {
  appTitle: string;
  onOpenApps: () => void;
  onRefresh: () => void;
};

export function PanelAppToolbar({
  appTitle,
  onOpenApps,
  onRefresh,
}: PanelAppToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-2 px-3.5 py-2 bg-white border-b border-gray-100 shrink-0">
      <button
        type="button"
        onClick={onOpenApps}
        className="inline-flex shrink-0 items-center rounded-md p-1.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
        title={t('appsTitle')}
        aria-label={t('appsTitle')}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
      </button>
      <span
        className="min-w-0 flex-1 truncate text-xs font-medium text-gray-600"
        title={appTitle}
      >
        {appTitle}
      </span>
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
