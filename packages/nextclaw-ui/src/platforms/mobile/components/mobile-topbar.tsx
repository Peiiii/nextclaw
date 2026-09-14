import { ArrowLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { resolveMobileRouteMeta } from "@/app/configs/app-navigation.config";
import { t } from "@/shared/lib/i18n";
import { IconActionButton } from "@/shared/components/ui/actions/icon-action-button";

export function MobileTopbar({ leadingInset }: { leadingInset?: string }) {
  const navigate = useNavigate();
  const { pathname, state } = useLocation();
  const routeMeta = resolveMobileRouteMeta(pathname, t, typeof state?.returnTo === 'string' ? state.returnTo : undefined);

  return (
    <header
      data-testid="mobile-topbar"
      className="shrink-0 border-b border-border/60 bg-background text-foreground"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      <div
        className="flex h-[var(--mobile-header-height)] items-center gap-2 pl-3 pr-3"
        style={{ paddingLeft: leadingInset ? `calc(${leadingInset} + 0.75rem)` : undefined }}
      >
        {routeMeta.backTarget ? (
          <IconActionButton
            size="lg"
            onClick={() => navigate(routeMeta.backTarget as string)}
            label={routeMeta.backLabel ?? t("backToMain")}
            icon={<ArrowLeft className="h-4 w-4" />}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-center text-[17px] font-semibold text-foreground">
            {routeMeta.title}
          </h1>
        </div>
        {routeMeta.backTarget ? <div className="w-[var(--icon-control-size)] shrink-0" aria-hidden="true" /> : null}
      </div>
    </header>
  );
}
