import type { ReactNode } from "react";
import { usePresenter } from "@/features/chat/components/providers/chat-presenter.provider";
import {
  buildSessionTypeOptions,
  DEFAULT_SESSION_TYPE,
  normalizeSessionType,
} from "@/features/chat/features/session-type/utils/chat-session-type.utils";
import { ChatWelcome } from "@/features/chat/features/welcome/components/chat-welcome";
import {
  resolveChatWelcomeAgents,
  resolveChatWelcomeDraftProjectRoot,
  resolveChatWelcomeSelectedSessionType,
} from "@/features/chat/features/welcome/utils/chat-welcome-draft.utils";
import { buildChatWelcomeProjectOptions } from "@/features/chat/features/welcome/utils/chat-welcome-project-options.utils";
import { useChatInputStore } from "@/features/chat/stores/chat-input.store";
import { useChatQueryStore } from "@/features/chat/stores/ncp-chat-query.store";
import { useChatSessionListStore } from "@/features/chat/stores/chat-session-list.store";
import { useChatThreadStore } from "@/features/chat/stores/chat-thread.store";
import { useAgents } from "@/shared/hooks/use-agents";
import type { NcpSessionSummaryView } from "@/shared/lib/api";
import { normalizeSessionProjectRootValue } from "@/shared/lib/session-project";

const EMPTY_NCP_SESSION_SUMMARIES: NcpSessionSummaryView[] = [];

type ChatConversationWelcomeProps = {
  inputSlot: ReactNode;
};

export function ChatConversationWelcome({
  inputSlot,
}: ChatConversationWelcomeProps) {
  const presenter = usePresenter();
  const inputSnapshot = useChatInputStore((state) => state.snapshot);
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
  const draftAgentId = threadSnapshot.agentId ?? selectedAgentId;
  const availableAgents = resolveChatWelcomeAgents({
    agents: agentsQuery.data?.agents,
    fallbackAgentId: draftAgentId,
  });
  const defaultProjectRoot = normalizeSessionProjectRootValue(
    config?.agents.defaults.workspace,
  );
  const selectedProjectRoot = normalizeSessionProjectRootValue(
    inputSnapshot.pendingProjectRoot,
  );
  const sessionTypeOptions = buildSessionTypeOptions(
    sessionTypesData?.options ?? [],
  );
  const defaultSessionType = normalizeSessionType(
    sessionTypesData?.defaultType ?? inputSnapshot.defaultSessionType ?? DEFAULT_SESSION_TYPE,
  );
  const selectedSessionType = resolveChatWelcomeSelectedSessionType({
    defaultSessionType,
    pendingSessionType: inputSnapshot.pendingSessionType,
    selectedSessionType: inputSnapshot.selectedSessionType,
    sessionTypeOptions,
  });
  const projectOptions = buildChatWelcomeProjectOptions({
    defaultProjectRoot,
    sessionSummaries,
  });
  const createDraftSessionForAgent = () => {
    const projectRoot = resolveChatWelcomeDraftProjectRoot({
      defaultProjectRoot,
      selectedProjectRoot,
    });
    if (projectRoot) {
      presenter.chatSessionListManager.createSession(selectedSessionType, projectRoot);
      return;
    }
    presenter.chatSessionListManager.createSession(selectedSessionType);
  };
  const selectDraftAgent = (agentId: string) => {
    presenter.chatSessionListManager.setSelectedAgentId(agentId);
    presenter.chatInputManager.setPendingSessionType(
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
      onCreateSession={createDraftSessionForAgent}
      onSelectAgent={selectDraftAgent}
      onSelectProjectRoot={presenter.chatInputManager.setPendingProjectRoot}
      onSelectSessionType={presenter.chatInputManager.setPendingSessionType}
    />
  );
}
