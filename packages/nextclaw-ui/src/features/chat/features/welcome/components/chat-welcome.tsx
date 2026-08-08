import type { ReactNode } from 'react';
import { useState } from 'react';
import { ChatSessionProjectDialog } from '@/features/chat/features/session/components/session-header/chat-session-project-dialog';
import { ChatWelcomeAgentPicker } from '@/features/chat/features/welcome/components/chat-welcome-agent-picker';
import { ChatWelcomePromptSuggestions } from '@/features/chat/features/welcome/components/chat-welcome-prompt-suggestions';
import { ChatWelcomeProjectPicker } from '@/features/chat/features/welcome/components/chat-welcome-project-picker';
import { ChatWelcomeSessionTypePicker } from '@/features/chat/features/welcome/components/chat-welcome-session-type-picker';
import type { ChatWelcomeProjectOption } from '@/features/chat/features/welcome/utils/chat-welcome-project-options.utils';
import type { ChatSessionTypeOption } from '@/features/chat/features/session-type/utils/chat-session-type.utils';
import type { AgentProfileView } from '@/shared/lib/api';
import { t } from '@/shared/lib/i18n';

type SessionTypeOption = ChatSessionTypeOption;

type ChatWelcomeProps = {
  agents: AgentProfileView[];
  inputSlot?: ReactNode;
  defaultProjectRoot?: string | null;
  projectOptions: readonly ChatWelcomeProjectOption[];
  selectedAgentId: string;
  selectedProjectRoot?: string | null;
  selectedSessionType: string;
  sessionTypeOptions: readonly SessionTypeOption[];
  onSelectAgent: (agentId: string) => void;
  onSelectPrompt: (prompt: string) => void;
  onSelectProjectRoot?: (projectRoot: string | null) => Promise<void> | void;
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
  onSelectAgent,
  onSelectPrompt,
  onSelectProjectRoot,
  onSelectSessionType,
}: ChatWelcomeProps) {
  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? null;
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [isProjectSaving, setIsProjectSaving] = useState(false);
  const resolvedProjectRoot = selectedProjectRoot ?? defaultProjectRoot ?? null;

  const saveProjectRoot = async (projectRoot: string | null) => {
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
    <div className="flex min-h-full items-center justify-center px-4 py-10 sm:p-8">
      <div className="w-full min-w-0 max-w-[min(680px,100%)]">
        <div className="text-center">
          <h2 className="text-2xl font-semibold leading-tight text-foreground sm:text-[2rem]">
            {t('chatWelcomeTitle')}
          </h2>
        </div>

        {inputSlot ? <div className="mt-6">{inputSlot}</div> : null}

        <div className="mt-2 flex justify-center px-1">
          <div
            role="group"
            aria-label={t('chatWelcomeContextLabel')}
            className="flex min-w-0 max-w-full flex-wrap items-center justify-center gap-0.5 rounded-xl bg-muted/40 p-1 text-sm text-muted-foreground"
          >
            {onSelectProjectRoot ? (
              <ChatWelcomeProjectPicker
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
        </div>

        <ChatWelcomePromptSuggestions onSelectPrompt={onSelectPrompt} />
      </div>

      {onSelectProjectRoot ? (
        <ChatSessionProjectDialog
          open={isProjectDialogOpen}
          currentProjectRoot={resolvedProjectRoot}
          defaultWorkspacePath={defaultProjectRoot}
          isSaving={isProjectSaving}
          onOpenChange={setIsProjectDialogOpen}
          onSave={saveProjectRoot}
        />
      ) : null}
    </div>
  );
}
