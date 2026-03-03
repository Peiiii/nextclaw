import { t } from '@/lib/i18n';
import { Bot, BrainCircuit, AlarmClock, MessageCircle } from 'lucide-react';

type ChatWelcomeProps = {
  onCreateSession: () => void;
};

const capabilities = [
  {
    icon: MessageCircle,
    titleKey: 'chatWelcomeCapability1Title' as const,
    descKey: 'chatWelcomeCapability1Desc' as const,
  },
  {
    icon: BrainCircuit,
    titleKey: 'chatWelcomeCapability2Title' as const,
    descKey: 'chatWelcomeCapability2Desc' as const,
  },
  {
    icon: AlarmClock,
    titleKey: 'chatWelcomeCapability3Title' as const,
    descKey: 'chatWelcomeCapability3Desc' as const,
  },
];

export function ChatWelcome({ onCreateSession }: ChatWelcomeProps) {
  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="max-w-lg w-full text-center">
        {/* Bot avatar */}
        <div className="mx-auto mb-6 h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Bot className="h-8 w-8 text-primary" />
        </div>

        {/* Greeting */}
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('chatWelcomeTitle')}</h2>
        <p className="text-sm text-gray-500 mb-8">{t('chatWelcomeSubtitle')}</p>

        {/* Capability cards */}
        <div className="grid grid-cols-3 gap-3">
          {capabilities.map((cap) => {
            const Icon = cap.icon;
            return (
              <button
                key={cap.titleKey}
                onClick={onCreateSession}
                className="rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-card hover:shadow-card-hover transition-shadow cursor-pointer"
              >
                <div className="h-9 w-9 rounded-xl bg-primary/8 flex items-center justify-center mb-3">
                  <Icon className="h-4.5 w-4.5 text-primary" />
                </div>
                <div className="text-sm font-semibold text-gray-900 mb-1">{t(cap.titleKey)}</div>
                <div className="text-[11px] text-gray-500 leading-relaxed">{t(cap.descKey)}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
