import { NavLink } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { getSettingsNavSections } from "@/app/configs/app-navigation.config";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import { useDesktopCapabilityAvailability } from "@/features/desktop-capabilities";
import { SettingsGroup } from "@/shared/components/settings/setting-row";

export function MobileSettingsShell() {
  const desktopCapabilityAvailable = useDesktopCapabilityAvailability();
  const settingsNavSections = getSettingsNavSections(t, {
    includeKeyboardShortcuts: false,
    includeDesktopCapabilities: desktopCapabilityAvailable,
  });

  return (
    <div
      data-testid="mobile-settings-shell"
      className="space-y-3 pb-4"
    >
      {settingsNavSections.map((section) => (
        <section key={section.label} className="space-y-2">
          <h2 className="px-1 pt-2 text-xs font-medium text-muted-foreground">{section.label}</h2>
          <SettingsGroup>
            {section.items.map((item) => (
              <NavLink
                key={item.target}
                to={item.target}
                className={({ isActive }) => cn(
                  "flex min-h-14 items-center gap-3 px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-border",
                  isActive
                    ? "bg-[var(--interaction-selection)]"
                    : "hover:bg-[var(--interaction-hover)] active:bg-[var(--interaction-hover)]",
                )}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground">
                  <item.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium text-foreground">{item.label}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
              </NavLink>
            ))}
          </SettingsGroup>
        </section>
      ))}
    </div>
  );
}
