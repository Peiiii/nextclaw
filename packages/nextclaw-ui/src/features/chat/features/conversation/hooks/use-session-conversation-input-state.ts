import { useCallback, useEffect, useMemo, type SetStateAction } from 'react';
import type { ChatComposerNode } from '@nextclaw/agent-chat-ui';
import type { NcpDraftAttachment } from '@nextclaw/ncp-react';

import type { ThinkingLevel } from '@/shared/lib/api';
import { DEFAULT_SESSION_TYPE } from '@/features/chat/features/session-type/utils/chat-session-type.utils';
import { createChatComposerNodesFromDraft } from '@/features/chat/features/input/utils/chat-composer-state.utils';
import { useChatThreadStore } from '@/features/chat/stores/chat-thread.store';
import {
  resolveChatComposerDraftKey,
  useChatComposerDraftStore,
  type ChatComposerDraftSnapshot,
} from '@/features/chat/stores/chat-composer-draft.store';
import {
  useSessionConversationPreferenceActions,
  type SessionConversationPreferenceSyncParams,
} from '@/features/chat/features/conversation/hooks/use-session-conversation-preference-actions';

type SessionConversationInputStateValue = string | null | undefined;
type SessionConversationSkillSelection = {
  readonly ref: string;
  readonly name: string;
};

export type SessionConversationComposerState = {
  readonly text: string;
  readonly nodes: readonly ChatComposerNode[];
  readonly selectedSkills: readonly string[];
  readonly skillRecords: readonly SessionConversationSkillSelection[];
};

export type SessionConversationInputSnapshot = SessionConversationComposerState & {
  readonly attachments: readonly NcpDraftAttachment[];
  readonly selectedModel: SessionConversationInputStateValue;
  readonly selectedThinkingLevel: ThinkingLevel | null;
  readonly pendingSessionType: string;
  readonly selectedSessionType: string | null;
  readonly pendingProjectRoot: string | null;
  readonly composerFocusRequestId: number;
  readonly sendError: string | null;
};

type SessionConversationOwnedInputSnapshot = ChatComposerDraftSnapshot;

export type SessionConversationInputPatch =
  Partial<SessionConversationOwnedInputSnapshot> |
  ((snapshot: SessionConversationInputSnapshot) => Partial<SessionConversationOwnedInputSnapshot>);

export type SessionConversationInputActions = {
  readonly update: (patch: SessionConversationInputPatch) => void;
  readonly syncComposer: (composer: SessionConversationComposerState) => void;
  readonly resetComposer: () => void;
  readonly restoreComposer: (
    composer: SessionConversationComposerState & {
      readonly attachments?: readonly NcpDraftAttachment[];
    },
  ) => void;
  readonly applyPromptSuggestion: (prompt: string) => void;
  readonly requestComposerFocusAtEnd: () => void;
  readonly consumeComposerFocusRequest: () => void;
  readonly setAttachments: (attachments: readonly NcpDraftAttachment[]) => void;
  readonly addAttachments: (attachments: readonly NcpDraftAttachment[]) => readonly NcpDraftAttachment[];
  readonly removeAttachment: (attachmentId: string) => void;
  readonly setSelectedThinkingLevel: (level: ThinkingLevel | null) => void;
  readonly syncSessionPreferences: (params: SessionConversationPreferenceSyncParams) => void;
  readonly setPendingSessionType: (sessionType: SetStateAction<string>) => void;
  readonly setPendingProjectRoot: (projectRoot: string | null) => void;
  readonly setSelectedSkills: (
    selectedSkills: readonly string[],
    skillRecords: readonly SessionConversationSkillSelection[],
  ) => void;
  readonly setSendError: (message: string | null) => void;
};

const EMPTY_COMPOSER_STATE: SessionConversationComposerState = {
  text: '',
  nodes: [],
  selectedSkills: [],
  skillRecords: [],
};

const createInitialInputSnapshot = (
  initialPrompt?: string | null,
): SessionConversationOwnedInputSnapshot => {
  const prompt = initialPrompt?.trim() ?? '';
  const composer = prompt
    ? {
        ...EMPTY_COMPOSER_STATE,
        text: prompt,
        nodes: createChatComposerNodesFromDraft(prompt),
      }
    : EMPTY_COMPOSER_STATE;
  return {
    ...composer,
    attachments: [],
    selectedModel: undefined,
    selectedThinkingLevel: null,
    pendingSessionType: DEFAULT_SESSION_TYPE,
    selectedSessionType: DEFAULT_SESSION_TYPE,
    composerFocusRequestId: prompt ? 1 : 0,
    sendError: null,
  };
};

const normalizeSessionType = (sessionType: string | null | undefined): string => {
  const trimmed = sessionType?.trim();
  return trimmed ? trimmed : DEFAULT_SESSION_TYPE;
};

const buildAttachmentKey = (attachment: NcpDraftAttachment): string => {
  return [
    attachment.assetUri ?? '',
    attachment.url ?? '',
    attachment.name,
    attachment.mimeType,
    String(attachment.sizeBytes),
    attachment.contentBase64 ?? '',
  ].join(':');
};

const mergeAttachments = (
  current: readonly NcpDraftAttachment[],
  next: readonly NcpDraftAttachment[],
): readonly NcpDraftAttachment[] => {
  const seen = new Set(current.map(buildAttachmentKey));
  const merged = [...current];
  next.forEach((attachment) => {
    const key = buildAttachmentKey(attachment);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(attachment);
    }
  });
  return merged;
};

function useSessionConversationAttachmentActions(params: {
  attachments: readonly NcpDraftAttachment[];
  update: (patch: SessionConversationInputPatch) => void;
}) {
  const { attachments: currentAttachments, update } = params;
  const setAttachments = useCallback((attachments: readonly NcpDraftAttachment[]) => {
    update({ attachments });
  }, [update]);
  const addAttachments = useCallback((attachments: readonly NcpDraftAttachment[]) => {
    if (attachments.length === 0) {
      return [];
    }
    const existingKeys = new Set(currentAttachments.map(buildAttachmentKey));
    const nextAttachments = mergeAttachments(currentAttachments, attachments);
    const insertedAttachments = nextAttachments.filter(
      (attachment) => !existingKeys.has(buildAttachmentKey(attachment)),
    );
    if (insertedAttachments.length > 0) {
      update({ attachments: nextAttachments });
    }
    return insertedAttachments;
  }, [currentAttachments, update]);
  const removeAttachment = useCallback((attachmentId: string) => {
    update((current) => ({
      attachments: current.attachments.filter((attachment) => attachment.id !== attachmentId),
    }));
  }, [update]);
  return { addAttachments, removeAttachment, setAttachments };
}

function usePersistedConversationInputSnapshot(
  initialPrompt: string | null | undefined,
  sessionKey: string | null,
) {
  const draftKey = resolveChatComposerDraftKey(sessionKey);
  const initialSnapshot = useMemo(
    () => createInitialInputSnapshot(initialPrompt),
    [initialPrompt],
  );
  const snapshot = useChatComposerDraftStore(
    (state) => state.drafts[draftKey] ?? initialSnapshot,
  );

  useEffect(() => {
    useChatComposerDraftStore.getState().ensureDraft(draftKey, initialSnapshot);
  }, [draftKey, initialSnapshot]);

  const update = useCallback((patch: SessionConversationInputPatch) => {
    useChatComposerDraftStore.getState().updateDraft(draftKey, initialSnapshot, (current) => {
      const resolvedPatch = typeof patch === 'function'
        ? patch({
            ...current,
            pendingProjectRoot: useChatThreadStore.getState().snapshot.draftProjectRoot,
          })
        : patch;
      return {
        ...current,
        ...resolvedPatch,
      };
    });
  }, [draftKey, initialSnapshot]);

  return { snapshot, update };
}

export const useSessionConversationInputState = (
  initialPrompt?: string | null,
  sessionKey: string | null = null,
) => {
  const pendingProjectRoot = useChatThreadStore((state) => state.snapshot.draftProjectRoot);
  const { snapshot, update } = usePersistedConversationInputSnapshot(
    initialPrompt,
    sessionKey,
  );

  const syncComposer = useCallback((composer: SessionConversationComposerState) => {
    update({
      text: composer.text,
      nodes: composer.nodes,
      selectedSkills: composer.selectedSkills,
      skillRecords: composer.skillRecords,
      sendError: null,
    });
  }, [update]);

  const resetComposer = useCallback(() => {
    update({
      ...EMPTY_COMPOSER_STATE,
      attachments: [],
      sendError: null,
    });
  }, [update]);

  const restoreComposer = useCallback((
    composer: SessionConversationComposerState & {
      readonly attachments?: readonly NcpDraftAttachment[];
    },
  ) => {
    update({
      ...composer,
    });
  }, [update]);

  const applyPromptSuggestion = useCallback((prompt: string) => {
    update({
      text: prompt,
      nodes: createChatComposerNodesFromDraft(prompt),
      selectedSkills: [],
      skillRecords: [],
      sendError: null,
      composerFocusRequestId: Date.now(),
    });
  }, [update]);

  const requestComposerFocusAtEnd = useCallback(() => {
    update((current) => ({
      composerFocusRequestId: current.composerFocusRequestId + 1,
    }));
  }, [update]);

  const consumeComposerFocusRequest = useCallback(() => {
    update({ composerFocusRequestId: 0 });
  }, [update]);

  const {
    addAttachments,
    removeAttachment,
    setAttachments,
  } = useSessionConversationAttachmentActions({
    attachments: snapshot.attachments,
    update,
  });

  const preferenceActions = useSessionConversationPreferenceActions({
    selectedModel: snapshot.selectedModel,
    selectedThinkingLevel: snapshot.selectedThinkingLevel,
    updatePreferences: update,
  });

  const setPendingSessionType = useCallback((sessionType: SetStateAction<string>) => {
    update((current) => {
      const nextSessionType = typeof sessionType === 'function'
        ? sessionType(current.pendingSessionType)
        : sessionType;
      const normalizedSessionType = normalizeSessionType(nextSessionType);
      return {
        pendingSessionType: normalizedSessionType,
        selectedSessionType: normalizedSessionType,
      };
    });
  }, [update]);

  const setPendingProjectRoot = useCallback((projectRoot: string | null) => {
    useChatThreadStore.getState().setSnapshot({ draftProjectRoot: projectRoot });
  }, []);

  const setSelectedSkills = useCallback((
    selectedSkills: readonly string[],
    skillRecords: readonly SessionConversationSkillSelection[],
  ) => {
    update({
      selectedSkills,
      skillRecords,
      sendError: null,
    });
  }, [update]);

  const setSendError = useCallback((message: string | null) => {
    update({ sendError: message });
  }, [update]);

  const actions = useMemo<SessionConversationInputActions>(() => ({
    update,
    syncComposer,
    resetComposer,
    restoreComposer,
    applyPromptSuggestion,
    requestComposerFocusAtEnd,
    consumeComposerFocusRequest,
    setAttachments,
    addAttachments,
    removeAttachment,
    ...preferenceActions,
    setPendingSessionType,
    setPendingProjectRoot,
    setSelectedSkills,
    setSendError,
  }), [
    update,
    syncComposer,
    resetComposer,
    restoreComposer,
    applyPromptSuggestion,
    requestComposerFocusAtEnd,
    consumeComposerFocusRequest,
    setAttachments,
    addAttachments,
    removeAttachment,
    preferenceActions,
    setPendingSessionType,
    setPendingProjectRoot,
    setSelectedSkills,
    setSendError,
  ]);

  return {
    inputSnapshot: {
      ...snapshot,
      pendingProjectRoot,
    },
    inputActions: actions,
  };
};
