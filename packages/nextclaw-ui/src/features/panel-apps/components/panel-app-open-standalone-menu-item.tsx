import { ExternalLink } from "lucide-react";
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
      rel="noopener noreferrer"
      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-[var(--interaction-hover)] hover:text-accent-foreground"
      onClick={onSelect}
    >
      <ExternalLink className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </a>
  );
}
