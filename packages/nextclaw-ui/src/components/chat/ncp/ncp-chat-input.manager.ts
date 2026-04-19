import type { ChatComposerNode } from '@nextclaw/agent-chat-ui';
import type { NcpDraftAttachment } from '@nextclaw/ncp-react';
import type { SetStateAction } from 'react';
import type { ThinkingLevel } from '@/api/types';
import { updateNcpSession } from '@/api/ncp-session';
import {
  createChatComposerNodesFromDraft,
  createInitialChatComposerNodes,
  deriveChatComposerDraft,
  deriveNcpMessagePartsFromComposer,
  deriveSelectedSkillsFromComposer,
  pruneComposerAttachments,
  syncComposerAttachments,
  syncComposerSkills
} from '@/components/chat/chat-composer-state';
import { useChatInputStore } from '@/components/chat/stores/chat-input.store';
import { useChatSessionListStore } from '@/components/chat/stores/chat-session-list.store';
import { useChatThreadStore } from '@/components/chat/stores/chat-thread.store';
import type { ChatInputSnapshot } from '@/components/chat/stores/chat-input.store';
import type { ChatStreamActionsManager } from '@/components/chat/managers/chat-stream-actions.manager';
import type { ChatUiManager } from '@/components/chat/managers/chat-ui.manager';
import type { ChatSessionListManager } from '@/components/chat/managers/chat-session-list.manager';
import { ChatSessionPreferenceSync } from '@/components/chat/chat-session-preference-sync';
import { isNcpChatSendDisabled } from '@/components/chat/chat-input/ncp-chat-input-availability.utils';
import { chatRecentModelsManager } from '@/components/chat/chat-recent-models.manager';
import { chatRecentSkillsManager } from '@/components/chat/chat-recent-skills.manager';
import type { ChatModelOption } from '@/components/chat/chat-input.types';
import { normalizeSessionType } from '@/components/chat/useChatSessionTypeState';
import { systemStatusManager } from '@/features/system-status';

export class NcpChatInputManager {
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
    private uiManager: ChatUiManager,
    private streamActionsManager: ChatStreamActionsManager,
    private sessionListManager: ChatSessionListManager
  ) {}

  private hasSnapshotChanges = (patch: Partial<ChatInputSnapshot>): boolean => {
    const current = useChatInputStore.getState().snapshot;
    for (const [key, value] of Object.entries(patch) as Array<[keyof ChatInputSnapshot, ChatInputSnapshot[keyof ChatInputSnapshot]]>) {
      if (!Object.is(current[key], value)) {
        return true;
      }
    }
    return false;
  };

  private resolveUpdateValue = <T>(prev: T, next: SetStateAction<T>): T => {
    if (typeof next === 'function') {
      return (next as (value: T) => T)(prev);
    }
    return next;
  };

  private isSameStringArray = (left: string[], right: string[]): boolean =>
    left.length === right.length && left.every((value, index) => value === right[index]);

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
    if (!this.hasSnapshotChanges(patch)) {
      return;
    }
    useChatInputStore.getState().setSnapshot(patch);
    if (
      Object.prototype.hasOwnProperty.call(patch, 'modelOptions') ||
      Object.prototype.hasOwnProperty.call(patch, 'selectedModel') ||
      Object.prototype.hasOwnProperty.call(patch, 'selectedThinkingLevel')
    ) {
      const { selectedModel } = useChatInputStore.getState().snapshot;
      this.reconcileThinkingForModel(selectedModel);
    }
  };

  setDraft = (next: SetStateAction<string>) => {
    const prev = useChatInputStore.getState().snapshot.draft;
    const value = this.resolveUpdateValue(prev, next);
    if (value === prev) {
      return;
    }
    this.syncComposerSnapshot(createChatComposerNodesFromDraft(value));
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
    useChatInputStore.getState().setSnapshot({ pendingSessionType: value });
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
        isRuntimeBlocked: systemStatusManager.isChatInteractionBlocked(),
      })
    ) {
      return;
    }
    const { selectedSkills: requestedSkills, composerNodes } = inputSnapshot;
    const sessionKey =
      threadSnapshot.sessionKey ??
      sessionSnapshot.selectedSessionKey ??
      this.sessionListManager.ensureDraftSession(inputSnapshot.selectedSessionType);
    this.setComposerNodes(createInitialChatComposerNodes());
    await this.streamActionsManager.sendMessage({
      message,
      sessionKey,
      agentId: sessionSnapshot.selectedAgentId,
      sessionType: inputSnapshot.selectedSessionType,
      model: inputSnapshot.selectedModel || undefined,
      thinkingLevel: inputSnapshot.selectedThinkingLevel ?? undefined,
      stopSupported: true,
      requestedSkills,
      attachments,
      parts,
      restoreDraftOnError: true,
      composerNodes
    });
    this.sessionListManager.promoteRootDraftSessionRoute(sessionKey);
  };

  stop = async () => {
    await this.streamActionsManager.stopCurrentRun();
  };

  goToProviders = () => {
    this.uiManager.goToProviders();
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
    chatRecentModelsManager.remember(value);
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
