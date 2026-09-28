import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, CircleHelp, CircleSlash, Loader2, MessageCircleQuestion, MessageSquareQuote, X } from "lucide-react";
import type { NcpRunHandle } from "@nextclaw/client-sdk";
import { nextclawClient } from "@/shared/lib/api";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import type { ChatUserQuestionReply } from "@/features/chat/features/message/utils/chat-message.utils";
import { ChatConversationTrack } from "@/features/chat/components/conversation/chat-conversation-track";
import { useChatMessageLayoutStore } from "@/features/chat/stores/chat-message-layout.store";
import { useSessionUserQuestions, type Question, type QuestionContext } from "@/features/chat/features/conversation/hooks/use-session-user-questions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";

const context = createContext<QuestionContext | null>(null);

export function SessionUserQuestionProvider({ children, sessionId, disabled, onResolved }: {
  children: ReactNode;
  sessionId: string | null;
  disabled: boolean;
  onResolved: (handle: NcpRunHandle) => Promise<void>;
}) {
  const value = useSessionUserQuestions({ sessionId, disabled, onResolved });
  return <context.Provider value={value}>{children}</context.Provider>;
}

export function UserQuestionInlineQuestions({ data }: { data: unknown }) {
  const state = useContext(context);
  const entries = data && typeof data === "object" && !Array.isArray(data) ? (data as { questions?: unknown }).questions : null;
  if (!Array.isArray(entries)) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 align-middle">
      {entries.map((entry) => {
        if (!entry || typeof entry !== "object" || typeof entry.id !== "string" || typeof entry.title !== "string") return null;
        const question = state?.questions.find((item) => item.id === entry.id);
        const status = question?.status ?? "pending";
        const label = status === "answered" ? t("chatUserQuestionAnswered") : status === "dismissed" ? t("chatUserQuestionDismissed") : t("chatUserQuestionPending");
        return status === "pending" ? (
          <button key={entry.id} type="button" aria-expanded={state?.openId === entry.id} onClick={(event) => state?.openQuestion(entry.id, event.currentTarget)}
            className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-muted/60 px-2 py-1 text-xs leading-4 text-foreground transition-colors hover:border-[var(--interaction-selection-border)] hover:bg-[var(--interaction-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <MessageCircleQuestion aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{entry.title}</span><span className="shrink-0 text-muted-foreground">{label}</span>
          </button>
        ) : (
          <span key={entry.id} className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1 text-xs leading-4 text-muted-foreground" title={question?.answer}>
            <span className="truncate">{entry.title}</span><span>· {label}</span>
          </span>
        );
      })}
    </span>
  );
}

export function UserQuestionReplyReference({ data }: { data: unknown }) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const reply = data as ChatUserQuestionReply;
  if (typeof reply.questionId !== "string" || typeof reply.title !== "string") return null;
  const dismissed = reply.action === "dismissed";
  const label = dismissed ? t("chatUserQuestionDismissed") : t("chatUserQuestionReplyReference");
  const Icon = dismissed ? CircleSlash : MessageSquareQuote;
  return (
    <blockquote data-chat-question-reference-id={reply.questionId}
      data-chat-question-message-id={reply.questionMessageId ?? undefined}
      aria-label={`${label}：${reply.title}`}
      title={`${label}：${reply.title}`}
      className="mb-2 flex max-w-full items-center gap-1.5 border-l-2 border-current/35 py-0.5 pl-2 text-xs leading-4 opacity-70">
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 truncate">{reply.title}</span>
    </blockquote>
  );
}

function UserQuestionPanel({ question, pending, state }: { question: Question; pending: readonly Question[]; state: QuestionContext }) {
  const [answer, setAnswer] = useState("");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [activeHelp, setActiveHelp] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);
  useEffect(() => { panelRef.current?.focus(); }, []);
  useEffect(() => { if (!question.options?.length) inputRef.current?.focus(); }, [question.options]);
  const resolve = async (action: "answer" | "dismiss", answerValue?: string) => {
    if (!state.sessionId || submittingRef.current || (action === "answer" && !answerValue?.trim())) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    setSelectedOption(action === "answer" && question.options?.includes(answerValue ?? "") ? answerValue ?? null : null);
    try {
      const result = await nextclawClient.sessions.resolveUserQuestion(state.sessionId, question.id, {
        action,
        ...(action === "answer" ? { answer: answerValue?.trim() } : {}),
      });
      state.closeQuestion();
      await state.refresh();
      if (result.handle) await state.onResolved(result.handle);
    } catch (cause) {
      setSelectedOption(null);
      setError(cause instanceof Error ? cause.message : t("chatUserQuestionFailed"));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };
  return (
    <div ref={panelRef} role="dialog" aria-label={question.title} tabIndex={-1}
      onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); state.closeQuestion(); } }}
      className="max-h-[min(70vh,30rem)] overflow-y-auto rounded-2xl border border-border bg-card p-3 text-card-foreground shadow-card outline-none sm:p-4">
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2"><CircleHelp aria-hidden="true" className="h-4 w-4" />{t("chatUserQuestionPanelHeading")}</div>
        <button type="button" aria-label={t("chatUserQuestionClose")} onClick={state.closeQuestion} className="-mr-1 rounded-md p-1 hover:bg-[var(--interaction-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="h-4 w-4" /></button>
      </div>
      {pending.length > 1 ? <nav aria-label={t("chatUserQuestionsLabel")} className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {pending.map((item) => <button key={item.id} type="button" aria-current={item.id === question.id ? "true" : undefined}
          onClick={() => state.openQuestion(item.id)}
          className="shrink-0 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-[var(--interaction-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[current=true]:bg-[var(--interaction-selection)] aria-[current=true]:text-foreground">{item.title}</button>)}
      </nav> : null}
      <h2 className="mt-3 text-base font-semibold leading-6">{question.title}</h2>
      <TooltipProvider delayDuration={180}>
        <div className="mt-2 space-y-0.5">
          {question.options?.map((option, index) => {
            const description = question.optionDescriptions?.[option];
            return <div key={option} className={cn("group flex min-h-10 w-full items-center rounded-xl transition-colors hover:bg-[var(--interaction-hover)]", question.recommendedOption === option && "bg-[var(--interaction-selection)]")}>
              <button type="button" aria-pressed={selectedOption === option} disabled={state.disabled || submitting} onClick={() => void resolve("answer", option)}
                className="flex min-h-10 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
                <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted/50 text-xs text-muted-foreground">{index < 26 ? String.fromCharCode(65 + index) : index + 1}</span>
                <span className="min-w-0 flex-1">{option}</span>
                {question.recommendedOption === option ? <span className="shrink-0 text-xs text-muted-foreground">{t("chatUserQuestionRecommended")}</span> : null}
                {submitting && selectedOption === option ? <Loader2 aria-label={t("chatUserQuestionSending")} className="h-4 w-4 animate-spin" /> : <ArrowRight aria-hidden="true" className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-opacity", question.recommendedOption === option ? "opacity-70" : "opacity-0 group-hover:opacity-70 group-focus-within:opacity-70")} />}
              </button>
              {description ? <Tooltip open={activeHelp === option} onOpenChange={(open) => setActiveHelp(open ? option : null)}>
                <TooltipTrigger asChild>
                  <button type="button" aria-label={`${option}：${t("chatUserQuestionOptionHelp")}`} onClick={() => setActiveHelp(activeHelp === option ? null : option)}
                    className="mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <CircleHelp aria-hidden="true" className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" align="end" className="max-w-64 whitespace-normal break-words text-xs">{description}</TooltipContent>
              </Tooltip> : null}
            </div>;
          })}
        </div>
      </TooltipProvider>
      <div className="mt-2 flex h-10 items-center gap-2.5 px-2">
        <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted/50 text-xs text-muted-foreground">{(question.options?.length ?? 0) < 26 ? String.fromCharCode(65 + (question.options?.length ?? 0)) : (question.options?.length ?? 0) + 1}</span>
        <input ref={inputRef} aria-label={t("chatUserQuestionAnswerLabel")} value={answer} disabled={state.disabled || submitting} onChange={(event) => setAnswer(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void resolve("answer", answer); } }} placeholder={t("chatUserQuestionAnswerPlaceholder")}
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50" />
        <button type="button" disabled={state.disabled || submitting} onClick={() => void resolve("dismiss")} className="h-8 shrink-0 rounded-full border border-border px-3 text-xs hover:bg-[var(--interaction-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">{t("chatUserQuestionDismiss")}</button>
        <button type="button" disabled={state.disabled || submitting || !answer.trim()} onClick={() => void resolve("answer", answer)} className="h-8 shrink-0 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:bg-muted disabled:text-muted-foreground">
          {submitting && !selectedOption ? t("chatUserQuestionSending") : t("chatUserQuestionSend")}
        </button>
      </div>
      {error ? <p role="alert" className="mt-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export function SessionUserQuestions() {
  const state = useContext(context);
  const layout = useChatMessageLayoutStore((snapshot) => snapshot.layout);
  if (!state?.sessionId) return null;
  const pending = state.questions.filter((question) => question.status === "pending");
  const openQuestion = pending.find((question) => question.id === state.openId);
  if (!pending.length && !state.error) return null;
  const content = (
    <div className={cn("relative mx-auto w-full", layout !== "flat" && "max-w-[min(1120px,100%)] px-3 sm:px-4")} aria-label={t("chatUserQuestionsLabel")}>
      {openQuestion ? <UserQuestionPanel key={openQuestion.id} question={openQuestion} pending={pending} state={state} /> : null}
      {pending.length && !openQuestion ? <button type="button" aria-expanded={false} onClick={(event) => state.openQuestion(pending[pending.length - 1]!.id, event.currentTarget)}
        className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-[var(--interaction-hover)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <MessageCircleQuestion aria-hidden="true" className="h-3.5 w-3.5" />{t("chatUserQuestionsPendingCount").replace("{{count}}", String(pending.length))}
      </button> : null}
      {state.error ? <button type="button" onClick={() => void state.refresh()} className="ml-2 text-xs text-destructive underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t("chatUserQuestionFailed")} · {t("chatHistoryRetry")}</button> : null}
    </div>
  );
  return layout === "flat"
    ? <ChatConversationTrack width="composer">{content}</ChatConversationTrack>
    : <div className="bg-background">{content}</div>;
}
