import { t } from '@/shared/lib/i18n';

const WELCOME_PROMPT_SUGGESTIONS = [
  {
    labelKey: 'chatWelcomeSuggestion1Label' as const,
    promptKey: 'chatWelcomeSuggestion1Prompt' as const,
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
}: {
  onSelectPrompt: (prompt: string) => void;
}) {
  return (
    <div className="mt-5 flex flex-wrap justify-center gap-2">
      {WELCOME_PROMPT_SUGGESTIONS.map((suggestion) => (
        <button
          key={suggestion.labelKey}
          type="button"
          onClick={() => onSelectPrompt(t(suggestion.promptKey))}
          className="rounded-full bg-muted/55 px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {t(suggestion.labelKey)}
        </button>
      ))}
    </div>
  );
}
