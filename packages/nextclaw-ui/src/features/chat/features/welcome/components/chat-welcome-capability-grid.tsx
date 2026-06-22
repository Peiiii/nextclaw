import { AlarmClock, BrainCircuit, MessageCircle } from 'lucide-react';
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
            onClick={() => onSelectPrompt(t(capability.promptKey))}
            className="min-w-0 rounded-2xl border border-border bg-card p-3 text-left text-card-foreground shadow-card transition-[border-color,box-shadow,transform] hover:border-primary/30 hover:shadow-card-hover sm:p-4"
          >
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-accent">
              <Icon className="h-4.5 w-4.5 text-primary" />
            </div>
            <div className="mb-1 text-sm font-semibold text-foreground">
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
