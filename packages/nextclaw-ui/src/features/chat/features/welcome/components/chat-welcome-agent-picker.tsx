import { AgentAvatar } from '@/shared/components/common/agent-avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/shared/components/ui/select';
import type { AgentProfileView } from '@/shared/lib/api';
import { t } from '@/shared/lib/i18n';

type ChatWelcomeAgentPickerProps = {
  agents: AgentProfileView[];
  selectedAgent: AgentProfileView | null;
  selectedAgentId: string;
  onSelectAgent: (agentId: string) => void;
};

export function ChatWelcomeAgentPicker({
  agents,
  selectedAgent,
  selectedAgentId,
  onSelectAgent,
}: ChatWelcomeAgentPickerProps) {
  return (
    <Select value={selectedAgentId} onValueChange={onSelectAgent}>
      <SelectTrigger
        aria-label={t('chatDraftAgentTitle')}
        className="h-auto w-auto min-w-0 gap-1 rounded-lg border-0 bg-transparent px-2 py-1.5 text-gray-500 shadow-none hover:bg-gray-100 hover:text-gray-800 focus:ring-0"
      >
        <span className="sr-only">{t('chatDraftAgentTitle')}</span>
        <div className="flex min-w-0 items-center gap-1.5">
          {selectedAgent ? (
            <>
              <AgentAvatar
                agentId={selectedAgent.id}
                displayName={selectedAgent.displayName}
                avatarUrl={selectedAgent.avatarUrl}
                className="h-5 w-5 shrink-0"
              />
              <span className="max-w-28 truncate text-sm font-medium">
                {selectedAgent.displayName?.trim() || selectedAgent.id}
              </span>
            </>
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
  );
}
