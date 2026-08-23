import { ChevronDown } from "lucide-react";
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
    <details
      aria-label={t("chatObservationEventLabel", language)}
      data-testid="chat-observation-event"
      className="group my-3 min-w-0 text-[11px] text-muted-foreground"
    >
      <summary
        aria-label={`${t("chatObservationEventLabel", language)}: ${event.eventType}. ${t("chatObservationEventShowDetails", language)}`}
        className="flex cursor-pointer list-none items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden"
      >
        <span className="h-px min-w-4 flex-1 bg-border/70" />
        <span className="inline-flex min-w-0 max-w-[min(80%,32rem)] items-center gap-1.5 px-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50"
          />
          <span className="shrink-0">
            {t("chatObservationEventLabel", language)}
          </span>
          <span aria-hidden="true" className="text-muted-foreground/60">·</span>
          <span className="min-w-0 truncate">
            {event.eventType}
          </span>
          <ChevronDown
            className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </span>
        <span className="h-px min-w-4 flex-1 bg-border/70" />
      </summary>
      <div className="mx-auto mt-3 max-w-2xl overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
        <div className="flex min-w-0 items-center gap-2 border-b border-border/60 bg-muted/35 px-3 py-2">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/55"
          />
          <span className="shrink-0 text-xs font-medium text-foreground/85">
            {t("chatObservationEventDetailsTitle", language)}
          </span>
          <span aria-hidden="true" className="text-muted-foreground/50">·</span>
          <span className="min-w-0 truncate text-[11px] text-muted-foreground">
            {event.eventType}
          </span>
        </div>
        <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-2 px-3 py-3 text-xs">
          <dt className="text-muted-foreground">
            {t("chatObservationEventExtension", language)}
          </dt>
          <dd className="min-w-0 truncate text-foreground/80">{event.extensionId}</dd>
          <dt className="text-muted-foreground">
            {t("chatObservationEventId", language)}
          </dt>
          <dd className="min-w-0 break-all font-mono text-[11px] text-foreground/75">
            {event.eventId}
          </dd>
          <dt className="text-muted-foreground">{t("chatObservationEventTime", language)}</dt>
          <dd className="text-foreground/80">
            <time dateTime={event.occurredAt}>
              {formatDateTime(event.occurredAt, language)}
            </time>
          </dd>
        </dl>
        <div className="border-t border-border/60 px-3 py-3">
          <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">
            {t("chatObservationEventPayloadLabel", language)}
          </div>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/55 px-3 py-2.5 text-[11px] leading-5 text-muted-foreground">
            {payload || t("chatObservationEventPayloadEmpty", language)}
          </pre>
        </div>
      </div>
    </details>
  );
}
