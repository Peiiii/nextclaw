import { t } from "@/shared/lib/i18n";
import type { ContextCompactionTimelineView } from "@/features/chat/features/session/utils/ncp-session-context-metadata.utils";
import type { ContextInheritanceTimelineView } from "@/features/chat/features/message/utils/chat-message-timeline.utils";

export function ChatContextCompactionDivider({
  checkpoint,
  inline = false,
}: {
  checkpoint?: ContextCompactionTimelineView;
  inline?: boolean;
}) {
  const isCompacting = !checkpoint || checkpoint.status === "compressing";
  const isFailed = checkpoint?.status === "failed";
  const isCancelled = checkpoint?.status === "cancelled";
  const title = checkpoint
    ? [
        `${t("chatContextCompactionCoveredMessages")}: ${checkpoint.coveredSessionMessageCount}`,
        `${t("chatContextCompactionOriginalTokens")}: ${checkpoint.originalEstimatedTokens}`,
        `${t("chatContextCompactionProjectedTokens")}: ${checkpoint.projectedEstimatedTokens}`,
      ].join("\n")
    : undefined;
  return (
    <div
      data-context-compaction-placement={inline ? "assistant" : "timeline"}
      className={inline
        ? "my-3 flex items-center gap-3 text-[11px] text-muted-foreground"
        : "my-4 flex items-center gap-3 text-[11px] text-muted-foreground"}
      aria-live="polite"
      title={title}
    >
      <div className="h-px flex-1 bg-border" />
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1">
        {isCompacting ? (
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/45" />
        )}
        <span>
          {isCompacting
            ? t("chatContextCompactionCompressing")
            : isCancelled
              ? t("chatContextCompactionCancelled")
              : isFailed
                ? t("chatContextCompactionFailed")
                : t("chatContextCompactionCompressed")}
        </span>
      </div>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

export function ChatContextInheritanceDivider({
  inheritance,
}: {
  inheritance: ContextInheritanceTimelineView;
}) {
  const title = [
    `${t("chatContextInheritanceSourceSession")}: ${inheritance.sourceSessionId}`,
    `${t("chatContextInheritanceMessages")}: ${inheritance.inheritedMessageCount}`,
  ].join("\n");
  return (
    <div
      className="my-4 flex items-center gap-3 text-[11px] text-emerald-700"
      title={title}
    >
      <div className="h-px flex-1 bg-emerald-100" />
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <span>{t("chatContextInheritanceInherited")}</span>
      </div>
      <div className="h-px flex-1 bg-emerald-100" />
    </div>
  );
}
