import { ExternalLink } from "lucide-react";
import { ACTION_FEEDBACK, ACTION_MENU_ITEM_CLASS } from '@/shared/components/ui/actions/action-feedback';
import { cn } from '@/shared/lib/utils';
import type { PanelAppEntryView } from "@/shared/lib/api";
import { t } from "@/shared/lib/i18n";

export function PanelAppOpenStandaloneMenuItem({
  entry,
  onSelect,
}: {
  entry: PanelAppEntryView;
  onSelect?: () => void;
}) {
  const label = typeof window !== "undefined" && window.nextclawDesktop
    ? t("panelAppsOpenInBrowser")
    : t("panelAppsOpenInNewTab");
  const href = `/apps/panel/${encodeURIComponent(entry.appId)}/standalone`;

  return (
    <a
      href={href}
      target="_blank"
      // Chrome captures non-auxiliary in-scope links into an installed PWA.
      // `opener` keeps this trusted same-origin target auxiliary, so the current browser owns the new tab.
      rel="opener"
      referrerPolicy="no-referrer"
      className={cn(ACTION_MENU_ITEM_CLASS, ACTION_FEEDBACK.item)}
      onClick={onSelect}
    >
      <ExternalLink className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </a>
  );
}
