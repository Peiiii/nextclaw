import { Boxes } from 'lucide-react';
import { t } from '@/shared/lib/i18n';

export function DocBrowserHomePage() {
  return (
    <div className="flex h-full items-center justify-center bg-background px-5 py-6">
      <div className="flex max-w-[260px] flex-col items-center gap-3 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-gray-100 bg-gray-50 text-gray-600 shadow-[0_1px_2px_rgba(30,20,10,0.04)]">
          <Boxes className="h-5 w-5" />
        </span>
        <span className="text-sm font-medium text-gray-800">{t('docBrowserHomeTitle')}</span>
      </div>
    </div>
  );
}
