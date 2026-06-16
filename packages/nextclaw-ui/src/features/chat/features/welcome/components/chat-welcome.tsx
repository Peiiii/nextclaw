import type { ReactNode } from 'react';
import { useState } from 'react';
import { Bot } from 'lucide-react';
import { ChatSessionProjectDialog } from '@/features/chat/features/session/components/session-header/chat-session-project-dialog';
import { ChatWelcomeAgentPicker } from '@/features/chat/features/welcome/components/chat-welcome-agent-picker';
import { ChatWelcomeCapabilityGrid } from '@/features/chat/features/welcome/components/chat-welcome-capability-grid';
import { ChatWelcomeProjectPicker } from '@/features/chat/features/welcome/components/chat-welcome-project-picker';
import { ChatWelcomeSessionTypePicker } from '@/features/chat/features/welcome/components/chat-welcome-session-type-picker';
import type { ChatWelcomeProjectOption } from '@/features/chat/features/welcome/utils/chat-welcome-project-options.utils';
import type { ChatInputSnapshot } from '@/features/chat/stores/chat-input.store';
import type { AgentProfileView } from '@/shared/lib/api';
import { t } from '@/shared/lib/i18n';

type SessionTypeOption = ChatInputSnapshot['sessionTypeOptions'][number];

type ChatWelcomeProps = {
  agents: AgentProfileView[];
  inputSlot?: ReactNode;
  defaultProjectRoot?: string | null;
  projectOptions: readonly ChatWelcomeProjectOption[];
  selectedAgentId: string;
  selectedProjectRoot?: string | null;
  selectedSessionType: string;
  sessionTypeOptions: readonly SessionTypeOption[];
  onCreateSession: () => void;
  onSelectAgent: (agentId: string) => void;
  onSelectProjectRoot?: (projectRoot: string) => Promise<void> | void;
  onSelectSessionType: (sessionType: string) => void;
};

export function ChatWelcome({
  agents,
  defaultProjectRoot,
  inputSlot,
  projectOptions,
  selectedAgentId,
  selectedProjectRoot,
  selectedSessionType,
  sessionTypeOptions,
  onCreateSession,
  onSelectAgent,
  onSelectProjectRoot,
  onSelectSessionType,
}: ChatWelcomeProps) {
  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? null;
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [isProjectSaving, setIsProjectSaving] = useState(false);
  const resolvedProjectRoot = selectedProjectRoot ?? defaultProjectRoot ?? null;

  const saveProjectRoot = async (projectRoot: string) => {
    if (!onSelectProjectRoot) {
      return;
    }
    setIsProjectSaving(true);
    try {
      await onSelectProjectRoot(projectRoot);
      setIsProjectDialogOpen(false);
    } finally {
      setIsProjectSaving(false);
    }
  };
  const selectableProjectRoot = Boolean(onSelectProjectRoot);

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-8 sm:p-8">
      <div className="min-w-0 w-full max-w-[min(760px,100%)]">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Bot className="h-8 w-8 text-primary" />
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-950 sm:text-3xl">
            {t('chatWelcomeTitle')}
          </h2>
          <p className="mt-3 text-sm font-medium text-gray-500 sm:text-base">
            {t('chatWelcomeSubtitle')}
          </p>
        </div>

        {inputSlot ? <div className="mt-8">{inputSlot}</div> : null}

        <div className="mt-3 flex flex-wrap items-center gap-2 px-1 text-sm text-gray-500">
          {onSelectProjectRoot ? (
            <ChatWelcomeProjectPicker
              defaultProjectRoot={defaultProjectRoot}
              isSaving={isProjectSaving}
              projectOptions={projectOptions}
              projectRoot={resolvedProjectRoot}
              selectable={selectableProjectRoot}
              onOpenProjectDialog={() => setIsProjectDialogOpen(true)}
              onSelectProjectRoot={saveProjectRoot}
            />
          ) : null}
          <ChatWelcomeAgentPicker
            agents={agents}
            selectedAgent={selectedAgent}
            selectedAgentId={selectedAgentId}
            onSelectAgent={onSelectAgent}
          />
          <ChatWelcomeSessionTypePicker
            options={sessionTypeOptions}
            selectedSessionType={selectedSessionType}
            onSelectSessionType={onSelectSessionType}
          />
        </div>

        <ChatWelcomeCapabilityGrid onCreateSession={onCreateSession} />
      </div>

      {onSelectProjectRoot ? (
        <ChatSessionProjectDialog
          open={isProjectDialogOpen}
          currentProjectRoot={resolvedProjectRoot}
          isSaving={isProjectSaving}
          onOpenChange={setIsProjectDialogOpen}
          onSave={saveProjectRoot}
        />
      ) : null}
    </div>
  );
}
