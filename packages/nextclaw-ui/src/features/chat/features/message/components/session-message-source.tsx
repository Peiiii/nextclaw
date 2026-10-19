import { useEffect, useMemo, useSyncExternalStore } from "react";
import { Button } from "@/shared/components/ui/button";
import { useI18n } from "@/app/components/i18n-provider";
import { SessionMessageSourceManager } from "../managers/session-message-source.manager";

export function SessionMessageSource({ sessionId, messageId, partCount }: { sessionId: string; messageId: string; partCount: number }) {
  const { t } = useI18n();
  const manager = useMemo(() => new SessionMessageSourceManager(sessionId, messageId, partCount), [sessionId, messageId, partCount]);
  useEffect(() => () => manager.dispose(), [manager]);
  const state = useSyncExternalStore(manager.subscribe, manager.getSnapshot);
  return <details className="mt-3 border-t border-border/50 pt-2 text-sm">
    <summary className="cursor-pointer text-muted-foreground [@media(pointer:coarse)]:min-h-11">{t("chatHistoryOriginalSource")}</summary>
    <p className="my-2 text-xs text-muted-foreground">{t("chatHistorySourceFragmentNotice")}</p>
    <label className="mr-3 text-xs">{t("chatHistorySourcePart")} <input type="number" min={1} max={partCount}
      className="w-20 min-h-8 rounded border bg-background px-2 py-1 text-foreground [@media(pointer:coarse)]:min-h-11" value={(state.displayedPart ?? state.part) + 1}
      onChange={event => manager.selectPart(Number(event.target.value) - 1)} /></label>
    <Button variant="outline" size="sm" className="[@media(pointer:coarse)]:min-h-11" disabled={state.status === "loading" || !state.hasMore} onClick={() => void manager.read()}>
      {state.status === "loading" ? t("chatHistorySourceLoading") : state.status === "error" ? t("chatHistorySourceRetry") : t("chatHistorySourceReadNext")}
    </Button>
    {state.status === "error" && <p role="alert" className="mt-2 text-destructive">{t("chatHistorySourceFailed")}</p>}
    {state.content && <pre tabIndex={0} className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded bg-muted/50 p-3 text-xs">{state.content}</pre>}
  </details>;
}
