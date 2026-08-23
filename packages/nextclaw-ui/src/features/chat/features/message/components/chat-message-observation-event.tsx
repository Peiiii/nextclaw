import { Activity } from "lucide-react";
import { formatDateTime, t } from "@/shared/lib/i18n";
import { useI18n } from "@/app/components/i18n-provider";
import {
  stringifyObservationEventPayload,
  type ObservationEventPartData,
} from "@/features/chat/features/message/utils/chat-message-observation-event.utils";

type ChatMessageObservationEventProps = {
  event: ObservationEventPartData;
};

export function ChatMessageObservationEvent({
  event,
}: ChatMessageObservationEventProps) {
  const { language } = useI18n();
  const payload = stringifyObservationEventPayload(event.payload);

  return (
    <section
      aria-label={t("chatObservationEventLabel", language)}
      data-testid="chat-observation-event"
      className="min-w-0 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2.5 text-foreground"
    >
      <div className="flex min-w-0 items-start gap-2">
        <Activity className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-xs font-semibold">
              {t("chatObservationEventLabel", language)}
            </span>
            <code className="max-w-full truncate rounded bg-amber-500/10 px-1.5 py-0.5 text-[11px] text-amber-800 dark:text-amber-200">
              {event.eventType}
            </code>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            <span>
              {t("chatObservationEventExtension", language)}: {event.extensionId}
            </span>
            <span aria-hidden="true">·</span>
            <time dateTime={event.occurredAt}>
              {formatDateTime(event.occurredAt, language)}
            </time>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {t("chatObservationEventId", language)}: {event.eventId}
          </div>
        </div>
      </div>
      <details className="mt-2 border-t border-amber-500/15 pt-2">
        <summary className="cursor-pointer text-[11px] font-medium text-amber-800/90 outline-none hover:text-amber-950 focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring dark:text-amber-200/90 dark:hover:text-amber-100">
          {t("chatObservationEventShowDetails", language)}
        </summary>
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-background/60 p-2 text-[11px] leading-5 text-muted-foreground">
          {payload || t("chatObservationEventPayloadEmpty", language)}
        </pre>
      </details>
    </section>
  );
}
