import type { ChatComposerNode } from '@nextclaw/agent-chat-ui';
import { isRuntimeDefaultModelValue } from '@nextclaw/shared';
import type { NcpDraftAttachment } from '@nextclaw/ncp-react';
import type { SetStateAction } from 'react';
import type { ThinkingLevel } from '@/shared/lib/api';
import { updateNcpSession } from '@/shared/lib/api';
import {
  createChatComposerNodesFromDraft,
  createInitialChatComposerNodes,
  deriveChatComposerDraft,
  deriveNcpMessagePartsFromComposer,
  deriveSelectedSkillsFromComposer,
  pruneComposerAttachments,
  syncComposerAttachments,
  syncComposerSkills
} from '@/features/chat/features/input/utils/chat-composer-state.utils';
import { useChatInputStore } from '@/features/chat/stores/chat-input.store';
import { useChatSessionListStore } from '@/features/chat/stores/chat-session-list.store';
import { useChatThreadStore } from '@/features/chat/stores/chat-thread.store';
import type { ChatInputSnapshot } from '@/features/chat/stores/chat-input.store';
import type { ChatRunManager } from '@/features/chat/managers/chat-run.manager';
import type { ChatSessionListManager } from '@/features/chat/managers/chat-session-list.manager';
import { ChatSessionPreferenceSync } from '@/features/chat/managers/chat-session-preference-sync.manager';
import { isNcpChatSendDisabled } from '@/features/chat/features/input/utils/ncp-chat-input-availability.utils';
import { isNcpChatRuntimeBlocked } from '@/features/chat/features/runtime/utils/ncp-chat-runtime-availability.utils';
import { chatRecentModelsManager } from '@/features/chat/managers/chat-recent-models.manager';
import { chatRecentSkillsManager } from '@/features/chat/managers/chat-recent-skills.manager';
import type { ChatModelOption } from '@/features/chat/types/chat-input.types';
import { normalizeSessionType } from '@/features/chat/features/session-type/utils/chat-session-type.utils';
import { systemStatusManager } from '@/features/system-status';
import { shouldClearPendingProjectRootOverride } from '@/features/chat/features/session/utils/chat-run-metadata.utils';
import { normalizeSessionProjectRootValue } from '@/shared/lib/session-project';

function resolveModelForSend(value: string): string | undefined {
  return value || undefined;
}

export class ChatInputManager {
  private readonly sessionPreferenceSync = new ChatSessionPreferenceSync(updateNcpSession);

  private buildAttachmentSignature = (attachment: NcpDraftAttachment): string =>
    [
      attachment.assetUri ?? '',
      attachment.url ?? '',
      attachment.name,
      attachment.mimeType,
      String(attachment.sizeBytes),
      attachment.contentBase64 ?? '',
    ].join(':');

  constructor(
    private chatRunManager: ChatRunManager,
    private sessionListManager: ChatSessionListManager
  ) {}

  private resolveUpdateValue = <T>(prev: T, next: SetStateAction<T>): T => {
    if (typeof next === 'function') {
      return (next as (value: T) => T)(prev);
    }
    return next;
  };

  private isSameStringArray = (left: string[], right: string[]): boolean =>
    left.length === right.length && left.every((value, index) => value === right[index]);

  private hasSnapshotChanges = (patch: Partial<ChatInputSnapshot>): boolean => {
    const current = useChatInputStore.getState().snapshot;
    for (const [key, value] of Object.entries(patch) as Array<[keyof ChatInputSnapshot, ChatInputSnapshot[keyof ChatInputSnapshot]]>) {
      if (!Object.is(current[key], value)) {
        return true;
      }
    }
    return false;
  };

  private isRuntimeBlockedForSend = (): boolean =>
    isNcpChatRuntimeBlocked(systemStatusManager.getStatusView());

  private syncComposerSnapshot = (nodes: ChatComposerNode[]) => {
    const currentAttachments = useChatInputStore.getState().snapshot.attachments;
    const attachments = pruneComposerAttachments(nodes, currentAttachments);
    useChatInputStore.getState().setSnapshot({
      composerNodes: nodes,
      attachments,
      draft: deriveChatComposerDraft(nodes),
      selectedSkills: deriveSelectedSkillsFromComposer(nodes)
    });
  };

  private syncComposerSnapshotWithAttachments = (
    nodes: ChatComposerNode[],
    attachments: NcpDraftAttachment[]
  ) => {
    useChatInputStore.getState().setSnapshot({
      composerNodes: nodes,
      attachments,
      draft: deriveChatComposerDraft(nodes),
      selectedSkills: deriveSelectedSkillsFromComposer(nodes)
    });
  };

  private dedupeAttachments = (attachments: NcpDraftAttachment[]): NcpDraftAttachment[] => {
    const seen = new Set<string>();
    const output: NcpDraftAttachment[] = [];
    for (const attachment of attachments) {
      const signature = this.buildAttachmentSignature(attachment);
      if (seen.has(signature)) {
        continue;
      }
      seen.add(signature);
      output.push(attachment);
    }
    return output;
  };

  syncSnapshot = (patch: Partial<ChatInputSnapshot>) => {
    const current = useChatInputStore.getState().snapshot;
    let resolvedPatch = patch;
    if (
      patch.defaultSessionType &&
      current.selectedSessionType === undefined &&
      patch.selectedSessionType === undefined
    ) {
      resolvedPatch = Object.assign({}, patch, {
        selectedSessionType: patch.defaultSessionType,
      });
    }
    if (!this.hasSnapshotChanges(resolvedPatch)) {
      return;
    }
    useChatInputStore.getState().setSnapshot(resolvedPatch);
    if (
      Object.prototype.hasOwnProperty.call(resolvedPatch, 'modelOptions') ||
      Object.prototype.hasOwnProperty.call(resolvedPatch, 'selectedModel') ||
      Object.prototype.hasOwnProperty.call(resolvedPatch, 'selectedThinkingLevel')
    ) {
      const { selectedModel } = useChatInputStore.getState().snapshot;
      this.reconcileThinkingForModel(selectedModel);
    }
  };

  resolveProjectRootForSend = (params: {
    sessionKey: string | null | undefined;
    selectedSessionProjectRoot: string | null | undefined;
  }): string | null => {
    const { sessionKey, selectedSessionProjectRoot } = params;
    const { pendingProjectRoot, pendingProjectRootSessionKey } =
      useChatInputStore.getState().snapshot;
    if (
      pendingProjectRoot !== null &&
      (!sessionKey || sessionKey === pendingProjectRootSessionKey)
    ) {
      return pendingProjectRoot;
    }
    if (!sessionKey) {
      return useChatInputStore.getState().snapshot.defaultProjectRoot;
    }
    return selectedSessionProjectRoot ?? null;
  };

  clearPendingProjectRootOverrideForSession = (params: {
    sessionKey: string | null | undefined;
    selectedSessionProjectRoot: string | null | undefined;
  }) => {
    const { pendingProjectRoot, pendingProjectRootSessionKey } =
      useChatInputStore.getState().snapshot;
    if (
      !shouldClearPendingProjectRootOverride({
        pendingProjectRoot,
        pendingProjectRootSessionKey,
        sessionKey: params.sessionKey,
        selectedSessionProjectRoot: params.selectedSessionProjectRoot,
      })
    ) {
      return;
    }
    useChatInputStore.getState().setSnapshot({
      pendingProjectRoot: null,
      pendingProjectRootSessionKey: null,
    });
  };

  clearPendingProjectRootOverrideForCurrentThread = () => {
    const { sessionKey, sessionProjectRoot } = useChatThreadStore.getState().snapshot;
    this.clearPendingProjectRootOverrideForSession({
      sessionKey,
      selectedSessionProjectRoot: sessionProjectRoot,
    });
  };

  syncSessionPreferences = this.sessionPreferenceSync.syncInputSelection;

  setDraft = (next: SetStateAction<string>) => {
    const prev = useChatInputStore.getState().snapshot.draft;
    const value = this.resolveUpdateValue(prev, next);
    if (value === prev) {
      return;
    }
    this.syncComposerSnapshot(createChatComposerNodesFromDraft(value));
  };

  requestComposerFocusAtEnd = () => {
    const currentRequest = useChatInputStore.getState().snapshot.composerFocusRequest;
    useChatInputStore.getState().setSnapshot({
      composerFocusRequest: {
        id: (currentRequest?.id ?? 0) + 1,
        placement: 'end',
      },
    });
  };

  consumeComposerFocusRequest = (requestId: number) => {
    const currentRequest = useChatInputStore.getState().snapshot.composerFocusRequest;
    if (currentRequest?.id !== requestId) {
      return;
    }
    useChatInputStore.getState().setSnapshot({ composerFocusRequest: null });
  };

  setComposerNodes = (next: SetStateAction<ChatComposerNode[]>) => {
    const prev = useChatInputStore.getState().snapshot.composerNodes;
    const value = this.resolveUpdateValue(prev, next);
    if (Object.is(value, prev)) {
      return;
    }
    this.syncComposerSnapshot(value);
  };

  addAttachments = (attachments: NcpDraftAttachment[]): NcpDraftAttachment[] => {
    if (attachments.length === 0) {
      return [];
    }
    const { snapshot } = useChatInputStore.getState();
    const existingSignatures = new Set(snapshot.attachments.map(this.buildAttachmentSignature));
    const nextAttachments = this.dedupeAttachments([...snapshot.attachments, ...attachments]);
    const insertedAttachments = nextAttachments.filter(
      (attachment) => !existingSignatures.has(this.buildAttachmentSignature(attachment))
    );
    if (insertedAttachments.length === 0) {
      return [];
    }
    const nextNodes = syncComposerAttachments(snapshot.composerNodes, nextAttachments);
    this.syncComposerSnapshotWithAttachments(nextNodes, nextAttachments);
    return insertedAttachments;
  };

  restoreComposerState = (nodes: ChatComposerNode[], attachments: NcpDraftAttachment[]) => {
    const nextAttachments = this.dedupeAttachments(attachments);
    const nextNodes = syncComposerAttachments(nodes, nextAttachments);
    this.syncComposerSnapshotWithAttachments(nextNodes, nextAttachments);
  };

  setPendingSessionType = (next: SetStateAction<string>) => {
    const prev = useChatInputStore.getState().snapshot.pendingSessionType;
    const value = this.resolveUpdateValue(prev, next);
    if (value === prev) {
      return;
    }
    useChatInputStore.getState().setSnapshot({
      pendingSessionType: value,
      selectedSessionType: value,
    });
  };

  setPendingProjectRoot = (projectRoot: string | null) => {
    const normalizedProjectRoot = normalizeSessionProjectRootValue(projectRoot);
    useChatInputStore.getState().setSnapshot({
      pendingProjectRoot: normalizedProjectRoot,
      pendingProjectRootSessionKey: null,
    });
  };

  send = async () => {
    const inputSnapshot = useChatInputStore.getState().snapshot;
    const sessionSnapshot = useChatSessionListStore.getState().snapshot;
    const threadSnapshot = useChatThreadStore.getState().snapshot;
    const message = inputSnapshot.draft.trim();
    const { attachments } = inputSnapshot;
    const parts = deriveNcpMessagePartsFromComposer(inputSnapshot.composerNodes, attachments);
    const hasSendableContent = parts.some(
      (part) => part.type !== 'text' || part.text.trim().length > 0
    );
    if (
      isNcpChatSendDisabled({
        snapshot: inputSnapshot,
        hasSendableDraft: hasSendableContent,
        isRuntimeBlocked: this.isRuntimeBlockedForSend(),
      })
    ) {
      return;
    }
    const { selectedSkills: requestedSkills, composerNodes } = inputSnapshot;
    const sessionKey =
      threadSnapshot.sessionKey ??
      sessionSnapshot.selectedSessionKey ??
      null;
    if (!sessionKey && inputSnapshot.selectedSessionType?.trim()) {
      this.sessionListManager.ensureDraftSession(inputSnapshot.selectedSessionType);
    }
    this.setComposerNodes(createInitialChatComposerNodes());
    try {
      await this.chatRunManager.sendMessage({
        message,
        sessionKey: sessionKey ?? undefined,
        agentId: sessionSnapshot.selectedAgentId,
        sessionType: inputSnapshot.selectedSessionType,
        model: resolveModelForSend(inputSnapshot.selectedModel),
        thinkingLevel: inputSnapshot.selectedThinkingLevel ?? undefined,
        projectRoot: this.resolveProjectRootForSend({
          sessionKey,
          selectedSessionProjectRoot: threadSnapshot.sessionProjectRoot,
        }),
        requestedSkills,
        attachments,
        parts,
        composerNodes,
      });
    } catch (error) {
      this.restoreComposerState(composerNodes, attachments);
      throw error;
    }
  };

  stop = async () => {
    await this.chatRunManager.stopCurrentRun();
  };

  setSelectedModel = (next: SetStateAction<string>) => {
    const prev = useChatInputStore.getState().snapshot.selectedModel;
    const value = this.resolveUpdateValue(prev, next);
    if (value === prev) {
      return;
    }
    useChatInputStore.getState().setSnapshot({ selectedModel: value });
    this.reconcileThinkingForModel(value);
  };

  setSelectedThinkingLevel = (next: SetStateAction<ThinkingLevel | null>) => {
    const prev = useChatInputStore.getState().snapshot.selectedThinkingLevel;
    const value = this.resolveUpdateValue(prev, next);
    if (value === prev) {
      return;
    }
    useChatInputStore.getState().setSnapshot({ selectedThinkingLevel: value });
  };

  selectSessionType = (value: string) => {
    const normalized = normalizeSessionType(value);
    useChatInputStore.getState().setSnapshot({ selectedSessionType: normalized, pendingSessionType: normalized });
  };

  setSelectedSkills = (next: SetStateAction<string[]>) => {
    const { snapshot } = useChatInputStore.getState();
    const { selectedSkills: prev } = snapshot;
    const value = this.resolveUpdateValue(prev, next);
    if (this.isSameStringArray(value, prev)) {
      return;
    }
    this.syncComposerSnapshot(syncComposerSkills(snapshot.composerNodes, value, snapshot.skillRecords));
  };

  selectModel = (value: string) => {
    this.setSelectedModel(value);
    chatRecentModelsManager.remember(value, {
      namespace: useChatInputStore.getState().snapshot.selectedSessionType,
    });
    if (!isRuntimeDefaultModelValue(value)) {
      chatRecentModelsManager.remember(value);
    }
    this.sessionPreferenceSync.syncSelectedSessionPreferences();
  };

  selectThinkingLevel = (value: ThinkingLevel) => {
    this.setSelectedThinkingLevel(value);
    this.sessionPreferenceSync.syncSelectedSessionPreferences();
  };

  rememberSkillSelection = (value: string) => {
    chatRecentSkillsManager.remember(value);
  };

  selectSkills = (next: string[]) => {
    const prev = useChatInputStore.getState().snapshot.selectedSkills;
    for (const value of next) {
      if (!prev.includes(value)) {
        this.rememberSkillSelection(value);
      }
    }
    this.setSelectedSkills(next);
  };

  private resolveThinkingForModel = (
    modelOption: ChatModelOption | undefined,
    current: ThinkingLevel | null
  ): ThinkingLevel | null => {
    const capability = modelOption?.thinkingCapability;
    if (!capability || capability.supported.length === 0) {
      return null;
    }
    if (current === 'off') {
      return 'off';
    }
    if (current && capability.supported.includes(current)) {
      return current;
    }
    if (capability.default && capability.supported.includes(capability.default)) {
      return capability.default;
    }
    return 'off';
  };

  private reconcileThinkingForModel = (model: string): void => {
    const { snapshot } = useChatInputStore.getState();
    const modelOption = snapshot.modelOptions.find((option) => option.value === model);
    const { selectedThinkingLevel } = snapshot;
    const nextThinking = this.resolveThinkingForModel(modelOption, selectedThinkingLevel);
    if (nextThinking !== selectedThinkingLevel) {
      useChatInputStore.getState().setSnapshot({ selectedThinkingLevel: nextThinking });
    }
  };
}
