import { AlarmClock, BrainCircuit, MessageCircle } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { t } from '@/shared/lib/i18n';

const WELCOME_CAPABILITIES = [
  {
    icon: MessageCircle,
    titleKey: 'chatWelcomeCapability1Title' as const,
    descKey: 'chatWelcomeCapability1Desc' as const,
    promptKey: 'chatWelcomeCapability1Prompt' as const,
  },
  {
    icon: BrainCircuit,
    titleKey: 'chatWelcomeCapability2Title' as const,
    descKey: 'chatWelcomeCapability2Desc' as const,
    promptKey: 'chatWelcomeCapability2Prompt' as const,
  },
  {
    icon: AlarmClock,
    titleKey: 'chatWelcomeCapability3Title' as const,
    descKey: 'chatWelcomeCapability3Desc' as const,
    promptKey: 'chatWelcomeCapability3Prompt' as const,
  },
];

export function ChatWelcomeCapabilityGrid({
  onSelectPrompt,
}: {
  onSelectPrompt: (prompt: string) => void;
}) {
  return (
    <div className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(min(100%,9.5rem),1fr))] gap-3">
      {WELCOME_CAPABILITIES.map((capability) => {
        const Icon = capability.icon;
        return (
          <button
            key={capability.titleKey}
            type="button"
            onClick={() => onSelectPrompt(t(capability.promptKey))}
            className={cn(
              'min-w-0 rounded-xl border border-border/75 bg-card p-3 text-left text-card-foreground shadow-none transition-colors sm:p-3.5',
              'hover:bg-muted/40',
            )}
          >
            <div className="mb-2.5 flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Icon className="h-4 w-4" />
            </div>
            <div className="mb-1 text-sm font-medium text-foreground">
              {t(capability.titleKey)}
            </div>
            <div className="text-[11px] leading-relaxed text-muted-foreground">
              {t(capability.descKey)}
            </div>
          </button>
        );
      })}
    </div>
  );
}
