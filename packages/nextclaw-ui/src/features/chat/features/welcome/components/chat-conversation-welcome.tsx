import type { ReactNode } from "react";
import type { SetStateAction } from "react";
import { usePresenter } from "@/features/chat/components/providers/chat-presenter.provider";
import {
  buildSessionTypeOptions,
  DEFAULT_SESSION_TYPE,
  normalizeSessionType,
} from "@/features/chat/features/session-type/utils/chat-session-type.utils";
import { ChatWelcome } from "@/features/chat/features/welcome/components/chat-welcome";
import {
  resolveChatWelcomeAgents,
  resolveChatWelcomeSelectedSessionType,
} from "@/features/chat/features/welcome/utils/chat-welcome-selection.utils";
import { buildChatWelcomeProjectOptions } from "@/features/chat/features/welcome/utils/chat-welcome-project-options.utils";
import { useChatQueryStore } from "@/features/chat/stores/ncp-chat-query.store";
import { useChatSessionListStore } from "@/features/chat/stores/chat-session-list.store";
import { useChatThreadStore } from "@/features/chat/stores/chat-thread.store";
import { useAgents } from "@/shared/hooks/use-agents";
import { useProjects } from "@/shared/hooks/use-projects";
import type { NcpSessionSummaryView } from "@/shared/lib/api";
import { normalizeSessionProjectRootValue } from "@/shared/lib/session-project";

const EMPTY_NCP_SESSION_SUMMARIES: NcpSessionSummaryView[] = [];

type ChatConversationWelcomeProps = {
  inputSlot: ReactNode;
  pendingProjectRoot: string | null;
  pendingSessionType: string;
  selectedSessionTypeValue: string | null;
  onSelectProjectRoot: (projectRoot: string | null) => void;
  onSelectPrompt: (prompt: string) => void;
  onSelectSessionType: (sessionType: SetStateAction<string>) => void;
};

export function ChatConversationWelcome({
  inputSlot,
  pendingProjectRoot,
  pendingSessionType,
  selectedSessionTypeValue,
  onSelectProjectRoot,
  onSelectPrompt,
  onSelectSessionType,
}: ChatConversationWelcomeProps) {
  const presenter = usePresenter();
  const selectedAgentId = useChatSessionListStore(
    (state) => state.snapshot.selectedAgentId,
  );
  const threadSnapshot = useChatThreadStore((state) => state.snapshot);
  const config = useChatQueryStore(
    (state) => state.snapshot.configQuery?.data ?? null,
  );
  const sessionSummaries = useChatQueryStore(
    (state) => state.snapshot.sessionsQuery?.data?.sessions ?? EMPTY_NCP_SESSION_SUMMARIES,
  );
  const sessionTypesData = useChatQueryStore(
    (state) => state.snapshot.sessionTypesQuery?.data ?? null,
  );
  const agentsQuery = useAgents();
  const projectsQuery = useProjects();
  const draftAgentId = threadSnapshot.agentId ?? selectedAgentId;
  const availableAgents = resolveChatWelcomeAgents({
    agents: agentsQuery.data?.agents,
    fallbackAgentId: draftAgentId,
  });
  const defaultProjectRoot = normalizeSessionProjectRootValue(
    config?.agents.defaults.workspace,
  );
  const selectedProjectRoot = normalizeSessionProjectRootValue(
    pendingProjectRoot,
  );
  const sessionTypeOptions = buildSessionTypeOptions(
    sessionTypesData?.options ?? [],
  );
  const defaultSessionType = normalizeSessionType(
    sessionTypesData?.defaultType ?? DEFAULT_SESSION_TYPE,
  );
  const selectedSessionType = resolveChatWelcomeSelectedSessionType({
    defaultSessionType,
    pendingSessionType,
    selectedSessionType: selectedSessionTypeValue,
    sessionTypeOptions,
  });
  const projectOptions = buildChatWelcomeProjectOptions({
    defaultProjectRoot,
    projects: projectsQuery.data?.projects ?? [],
    sessionSummaries,
  });
  const selectDraftAgent = (agentId: string) => {
    presenter.chatSessionListManager.setSelectedAgentId(agentId);
    onSelectSessionType(
      resolveChatWelcomeSelectedSessionType({
        agents: availableAgents,
        agentId,
        defaultSessionType,
        pendingSessionType: null,
        selectedSessionType: null,
        sessionTypeOptions,
      }),
    );
  };

  return (
    <ChatWelcome
      agents={availableAgents}
      defaultProjectRoot={defaultProjectRoot}
      inputSlot={inputSlot}
      projectOptions={projectOptions}
      selectedAgentId={draftAgentId}
      selectedProjectRoot={selectedProjectRoot}
      selectedSessionType={selectedSessionType}
      sessionTypeOptions={sessionTypeOptions}
      onSelectAgent={selectDraftAgent}
      onSelectPrompt={onSelectPrompt}
      onSelectProjectRoot={onSelectProjectRoot}
      onSelectSessionType={onSelectSessionType}
    />
  );
}
