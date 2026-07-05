import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { IconActionButton } from "@/shared/components/ui/actions/icon-action-button";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

export function ChatParentSessionBanner({
  parentSessionLabel,
  onGoToParentSession,
}: {
  parentSessionLabel: string | null;
  onGoToParentSession: () => void;
}) {
  if (!parentSessionLabel) {
    return null;
  }
  const trimmedLabel = parentSessionLabel.trim();
  return (
    <div className="bg-background/75 px-4 py-2 backdrop-blur-sm sm:px-5">
      <button
        type="button"
        onClick={onGoToParentSession}
        className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>
          {t("chatBackToParent")}
          {trimmedLabel ? ` · ${trimmedLabel}` : ""}
        </span>
      </button>
    </div>
  );
}

export function ChatConversationHeader({
  layoutMode,
  actions,
  leading,
  onBackToList,
  projectBadge,
  sessionTypeBadge,
  shouldShow,
  title,
  titleContent,
}: {
  layoutMode: "desktop" | "mobile";
  actions?: ReactNode;
  leading?: ReactNode;
  onBackToList?: () => void;
  projectBadge?: ReactNode;
  sessionTypeBadge?: ReactNode;
  shouldShow: boolean;
  title: string;
  titleContent?: ReactNode;
}) {
  const isMobileLayout = layoutMode === "mobile";

  return (
    <div
      data-testid="chat-conversation-header"
      className={cn(
        "bg-background/80 backdrop-blur-sm flex items-center justify-between shrink-0 overflow-hidden transition-colors duration-200",
        isMobileLayout ? "px-3 sm:px-3" : "px-4 sm:px-5",
        shouldShow ? "opacity-100" : "h-0 py-0 opacity-0",
        shouldShow && (isMobileLayout ? "min-h-12 pb-2 pt-2" : "h-[52px]"),
      )}
      style={
        isMobileLayout && shouldShow
          ? { paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.5rem)" }
          : undefined
      }
    >
      <div className="min-w-0 flex-1 flex items-center gap-2">
        {isMobileLayout && onBackToList ? (
          <IconActionButton
            icon={<ArrowLeft className="h-4 w-4" />}
            label={t("chat")}
            onClick={onBackToList}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          />
        ) : null}
        {leading}
        {titleContent ?? (
          <span className="text-sm font-medium text-foreground truncate">
            {title}
          </span>
        )}
        {sessionTypeBadge}
        {projectBadge}
      </div>
      {actions}
    </div>
  );
}
