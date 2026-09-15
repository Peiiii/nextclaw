import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, History, X } from 'lucide-react';
import { buildSessionPath } from '@/features/chat/features/session/utils/chat-session-route.utils';
import type { ChatWelcomeContinuation } from '@/features/chat/features/welcome/utils/chat-welcome-continuation.utils';
import { t } from '@/shared/lib/i18n';

const WELCOME_PROMPT_SUGGESTIONS = [
  {
    labelKey: 'chatWelcomeOpenStartLabel' as const,
    promptKey: 'chatWelcomeOpenStartPrompt' as const,
  },
  {
    labelKey: 'chatWelcomeSuggestion2Label' as const,
    promptKey: 'chatWelcomeSuggestion2Prompt' as const,
  },
  {
    labelKey: 'chatWelcomeSuggestion3Label' as const,
    promptKey: 'chatWelcomeSuggestion3Prompt' as const,
  },
];

export function ChatWelcomePromptSuggestions({
  onSelectPrompt,
  hasDraftContent = false,
  hasProject = false,
  continuation,
}: {
  onSelectPrompt: (prompt: string) => void;
  hasDraftContent?: boolean;
  hasProject?: boolean;
  continuation?: ChatWelcomeContinuation | null;
}) {
  const [dismissedSessionKey, setDismissedSessionKey] = useState<string | null>(null);
  const showContinuation = continuation && continuation.sessionKey !== dismissedSessionKey;
  return (
    <div className={`mt-3 min-h-32 ${hasDraftContent ? 'invisible' : ''}`} aria-hidden={hasDraftContent || undefined}>
      <div className="flex flex-wrap justify-center gap-x-2 gap-y-1">
        {WELCOME_PROMPT_SUGGESTIONS.map((suggestion, index) => {
          const projectStart = index === 2 && hasProject;
          return (
            <button
              key={suggestion.labelKey}
              type="button"
              onClick={() => onSelectPrompt(t(projectStart ? 'chatWelcomeSuggestion1Prompt' : suggestion.promptKey))}
              className="rounded-lg bg-muted/70 px-3 py-1.5 text-[13px] font-normal leading-5 text-foreground/80 transition-colors hover:bg-[var(--interaction-hover)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {t(projectStart ? 'chatWelcomeSuggestion1Label' : suggestion.labelKey)}
            </button>
          );
        })}
      </div>
      {continuation ? (
        <div className={`mx-auto mt-5 flex min-w-0 max-w-lg items-center gap-1 border-t border-border/50 pt-3 ${showContinuation ? '' : 'invisible'}`} aria-hidden={!showContinuation || undefined}>
          <Link
            to={buildSessionPath(continuation.sessionKey)}
            title={t('chatWelcomeContinueHint')}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-[var(--interaction-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <History aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-muted-foreground">{t('chatWelcomeContinueLabel')}</span>
              <span className="mt-1 block truncate text-sm text-foreground">{continuation.title}</span>
            </span>
            <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
          <button
            type="button"
            aria-label={t('chatWelcomeDismissContinue')}
            title={t('chatWelcomeDismissContinue')}
            onClick={() => setDismissedSessionKey(continuation.sessionKey)}
            className="mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-[var(--interaction-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
