import { ArrowLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { resolveMobileRouteMeta } from "@/app/configs/app-navigation.config";
import { t } from "@/shared/lib/i18n";

export function MobileTopbar({ leadingInset }: { leadingInset?: string }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const routeMeta = resolveMobileRouteMeta(pathname, t);

  return (
    <header
      data-testid="mobile-topbar"
      className="shrink-0 border-b border-border/60 bg-secondary text-foreground"
      style={{
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.25rem)",
      }}
    >
      <div
        className="flex min-h-[2.75rem] items-center gap-2 py-1.5 pl-3 pr-3"
        style={{ paddingLeft: leadingInset ? `calc(${leadingInset} + 0.75rem)` : undefined }}
      >
        {routeMeta.backTarget ? (
          <button
            type="button"
            onClick={() => navigate(routeMeta.backTarget as string)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={routeMeta.backLabel ?? t("backToMain")}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-center text-[17px] font-semibold text-foreground">
            {routeMeta.title}
          </h1>
        </div>
        {routeMeta.backTarget ? <div className="h-11 w-11 shrink-0" aria-hidden="true" /> : null}
      </div>
    </header>
  );
}
