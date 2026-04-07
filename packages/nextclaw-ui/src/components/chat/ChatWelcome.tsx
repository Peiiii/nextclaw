import type { AgentProfileView } from '@/api/types';
import { AgentAvatar } from '@/components/common/AgentAvatar';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { t } from '@/lib/i18n';
import { Bot, BrainCircuit, AlarmClock, MessageCircle } from 'lucide-react';

type ChatWelcomeProps = {
  onCreateSession: () => void;
  agents: AgentProfileView[];
  selectedAgentId: string;
  onSelectAgent: (agentId: string) => void;
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

export function ChatWelcome({ onCreateSession, agents, selectedAgentId, onSelectAgent }: ChatWelcomeProps) {
  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? null;

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

        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="text-[13px] font-medium text-gray-500">
            {t('chatDraftAgentTitle')}
          </span>
          <Select value={selectedAgentId} onValueChange={onSelectAgent}>
            <SelectTrigger
              aria-label={t('chatDraftAgentTitle')}
              className="h-auto w-auto gap-1 rounded-full border-0 bg-transparent px-1.5 py-1 text-gray-500 shadow-none hover:bg-white/70 hover:text-gray-800 focus:ring-0"
            >
              <span className="sr-only">{t('chatDraftAgentTitle')}</span>
              <div className="flex items-center gap-1.5">
                {selectedAgent ? (
                  <AgentAvatar
                    agentId={selectedAgent.id}
                    displayName={selectedAgent.displayName}
                    avatarUrl={selectedAgent.avatarUrl}
                    className="h-7 w-7 shrink-0"
                  />
                ) : null}
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-xl border-gray-200/80 shadow-lg">
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id} className="rounded-lg pr-10">
                  <div className="flex min-w-0 items-center gap-2">
                    <AgentAvatar
                      agentId={agent.id}
                      displayName={agent.displayName}
                      avatarUrl={agent.avatarUrl}
                      className="h-5 w-5 shrink-0"
                    />
                    <span className="truncate text-sm font-medium text-gray-700">
                      {agent.displayName?.trim() || agent.id}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
