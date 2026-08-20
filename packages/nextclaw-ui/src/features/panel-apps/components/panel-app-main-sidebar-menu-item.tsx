import { PanelLeft, PanelLeftDashed } from 'lucide-react';
import { useUpdatePanelAppPreferences } from '@/features/panel-apps/hooks/use-panel-apps';
import type { PanelAppEntryView } from '@/shared/lib/api';
import { t } from '@/shared/lib/i18n';

export function PanelAppMainSidebarMenuItem({
  entry,
  onSelect,
}: {
  entry: PanelAppEntryView;
  onSelect?: () => void;
}) {
  const updatePreferences = useUpdatePanelAppPreferences();
  const label = entry.mainSidebar
    ? t('panelAppsRemoveFromMainSidebar')
    : t('panelAppsAddToMainSidebar');
  const Icon = entry.mainSidebar ? PanelLeftDashed : PanelLeft;

  return (
    <button
      type="button"
      disabled={updatePreferences.isPending}
      aria-pressed={entry.mainSidebar}
      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-[var(--interaction-hover)] hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
      onClick={() => {
        onSelect?.();
        updatePreferences.mutate({
          id: entry.id,
          preferences: { mainSidebar: !entry.mainSidebar },
        });
      }}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </button>
  );
}
