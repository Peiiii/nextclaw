import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { eventKeys, type NcpRunHandle, type UiNcpSessionUserQuestionsView } from "@nextclaw/client-sdk";
import { NcpEventType } from "@nextclaw/ncp";
import { nextclawClient } from "@/shared/lib/api";

const QUESTION_QUERY_KEY = "session-user-questions";
export type Question = UiNcpSessionUserQuestionsView["questions"][number];
export type QuestionContext = {
  questions: readonly Question[];
  openId: string | null;
  openQuestion: (id: string, trigger?: HTMLElement) => void;
  closeQuestion: () => void;
  sessionId: string | null;
  disabled: boolean;
  onResolved: (handle: NcpRunHandle) => Promise<void>;
  refresh: () => Promise<void>;
  error: boolean;
};

function readSeenIds(sessionId: string): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(`nextclaw-question-seen:${sessionId}`) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function markSeen(sessionId: string, ids: Set<string>) {
  try {
    sessionStorage.setItem(`nextclaw-question-seen:${sessionId}`, JSON.stringify([...ids]));
  } catch { /* Storage may be disabled. The current mount still tracks seen IDs. */ }
}

export function useSessionUserQuestions({ sessionId, disabled, onResolved }: {
  sessionId: string | null;
  disabled: boolean;
  onResolved: (handle: NcpRunHandle) => Promise<void>;
}): QuestionContext {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: [QUESTION_QUERY_KEY, sessionId],
    queryFn: () => nextclawClient.sessions.listUserQuestions(sessionId as string),
    enabled: Boolean(sessionId),
    retry: false,
    staleTime: 0,
  });
  const [manualOpen, setManualOpen] = useState<{ sessionId: string; id: string } | null>(null);
  const [suppressed, setSuppressed] = useState<{ sessionId: string; ids: Set<string> } | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const questions = useMemo(() => query.data?.questions ?? [], [query.data]);
  const pending = questions.filter((question) => question.status === "pending");
  const seen = sessionId ? readSeenIds(sessionId) : new Set<string>();
  if (suppressed?.sessionId === sessionId) for (const id of suppressed.ids) seen.add(id);
  const autoOpenId = pending.findLast((question) => !seen.has(question.id))?.id ?? null;
  const openId = manualOpen?.sessionId === sessionId && pending.some((question) => question.id === manualOpen.id)
    ? manualOpen.id
    : autoOpenId;
  const refresh = async () => {
    if (sessionId) await queryClient.invalidateQueries({ queryKey: [QUESTION_QUERY_KEY, sessionId], exact: true });
  };
  useEffect(() => {
    if (!sessionId) return undefined;
    const invalidate = () => void queryClient.invalidateQueries({ queryKey: [QUESTION_QUERY_KEY, sessionId], exact: true });
    const unsubscribeEvent = nextclawClient.eventBus.on(eventKeys.ncpEvent, (event) => {
      if (event.type !== NcpEventType.MessageSent || event.payload.sessionId !== sessionId) return;
      const { message } = event.payload;
      if (typeof message.metadata?.nextclaw_user_question_id === "string" ||
          message.parts.some((part) => part.type === "extension" && part.extensionType === "nextclaw.user-question")) invalidate();
    });
    const unsubscribeQueue = nextclawClient.eventBus.on(eventKeys.sessionRunQueueUpdated, (event) => {
      if (event.sessionKey === sessionId) invalidate();
    });
    return () => { unsubscribeEvent(); unsubscribeQueue(); };
  }, [queryClient, sessionId]);
  return {
    questions,
    openId,
    openQuestion: (id, trigger) => {
      if (!sessionId) return;
      triggerRef.current = trigger ?? null;
      setManualOpen({ sessionId, id });
    },
    closeQuestion: () => {
      if (sessionId) {
        const ids = new Set([...readSeenIds(sessionId), ...pending.map((question) => question.id)]);
        markSeen(sessionId, ids);
        setSuppressed({ sessionId, ids });
      }
      setManualOpen(null);
      triggerRef.current?.focus();
      triggerRef.current = null;
    },
    sessionId,
    disabled,
    onResolved,
    refresh,
    error: Boolean(query.error),
  };
}
