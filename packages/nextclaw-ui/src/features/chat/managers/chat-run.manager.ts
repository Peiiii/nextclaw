import { buildNcpRequestEnvelope } from '@nextclaw/ncp-react';
import { useChatInputStore } from '@/features/chat/stores/chat-input.store';
import { useChatThreadStore } from '@/features/chat/stores/chat-thread.store';
import type { ChatUiManager } from '@/features/chat/managers/chat-ui.manager';
import type {
  ChatRunRuntime,
  ChatRunSnapshot,
  SendMessageParams,
} from '@/features/chat/types/chat-run.types';
import { buildChatRunMetadata } from '@/features/chat/features/session/utils/chat-run-metadata.utils';

export class ChatRunManager {
  private activeRuntime: ChatRunRuntime | null = null;

  constructor(private uiManager: ChatUiManager) {}

  setActiveRuntime = (runtime: ChatRunRuntime | null) => {
    this.activeRuntime = runtime;
  };

  sendMessage = async (payload: SendMessageParams) => {
    const runtime = this.activeRuntime;
    if (!runtime || runtime.sessionKey !== (payload.sessionKey ?? null)) {
      return;
    }
    const metadata = buildChatRunMetadata({
      agentId: payload.agentId,
      model: payload.model,
      thinkingLevel: payload.thinkingLevel,
      sessionType: payload.sessionType,
      projectRoot: payload.projectRoot,
      requestedSkills: payload.requestedSkills,
      composerNodes: payload.composerNodes,
    });
    const envelope = buildNcpRequestEnvelope({
      sessionId: payload.sessionKey,
      text: payload.message,
      attachments: payload.attachments,
      parts: payload.parts,
      metadata,
    });
    if (!envelope) {
      return;
    }
    const handle = await runtime.sendEnvelope(envelope);
    if (!payload.sessionKey && handle?.sessionId) {
      this.materializeRootSessionRoute(handle.sessionId);
    }
  };

  stopCurrentRun = async () => {
    await this.activeRuntime?.abortCurrentRun();
  };

  resumeRun = async (run: { sessionKey: string }) => {
    if (this.activeRuntime?.sessionKey !== run.sessionKey) {
      return;
    }
    await this.activeRuntime.resumeCurrentSessionRun();
  };

  applyRunSnapshot = (snapshot: ChatRunSnapshot) => {
    const isSending = snapshot.isSending || snapshot.isRunning;
    useChatInputStore.getState().setSnapshot({
      canStopGeneration: snapshot.isRunning,
      stopDisabledReason: snapshot.isRunning ? null : '__preparing__',
      stopSupported: true,
      stopReason: undefined,
      sendError: snapshot.sendErrorMessage,
      isSending,
    });
    useChatThreadStore.getState().setSnapshot({
      isHistoryLoading: snapshot.isHydrating,
      messages: snapshot.visibleMessages,
      isSending,
      isAwaitingAssistantOutput: snapshot.isRunning,
      contextWindow: snapshot.contextWindow,
    });
    if (!snapshot.routeSessionKey && snapshot.materializedSessionKey) {
      this.materializeRootSessionRoute(snapshot.materializedSessionKey);
    }
  };

  clearRunState = () => {
    useChatInputStore.getState().setSnapshot({
      canStopGeneration: false,
      stopDisabledReason: '__preparing__',
      sendError: null,
      isSending: false,
    });
    useChatThreadStore.getState().setSnapshot({
      isHistoryLoading: false,
      messages: [],
      isSending: false,
      isAwaitingAssistantOutput: false,
      contextWindow: null,
    });
  };

  private materializeRootSessionRoute = (sessionKey: string) => {
    const normalizedSessionKey = sessionKey.trim();
    if (!normalizedSessionKey || !this.uiManager.isAtChatRoot()) {
      return;
    }
    this.uiManager.goToSession(normalizedSessionKey, { replace: true });
  };
}
