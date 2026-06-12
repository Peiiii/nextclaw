import { isRuntimeDefaultModelValue } from '@nextclaw/shared';
import type { SessionPatchUpdate, ThinkingLevel } from '@/shared/lib/api';
import { useChatInputStore } from '@/features/chat/stores/chat-input.store';
import { useChatSessionListStore } from '@/features/chat/stores/chat-session-list.store';
import { useChatThreadStore } from '@/features/chat/stores/chat-thread.store';
import {
  resolveSelectedModelValue,
  resolveSelectedThinkingLevelValue,
} from '@/features/chat/features/session/utils/chat-session-preference-governance.utils';

type QueuedSessionPreferenceSync = { sessionKey: string; patch: SessionPatchUpdate };

function normalizeOptionalModel(value: string): string | null {
  if (isRuntimeDefaultModelValue(value)) {
    return null;
  }
  const normalized = value.trim(); return normalized.length > 0 ? normalized : null;
}

export class ChatSessionPreferenceSync {
  private inFlight: Promise<void> | null = null;
  private queued: QueuedSessionPreferenceSync | null = null;
  private previousPreferenceSessionKey: string | null | undefined = undefined;

  constructor(
    private readonly updateSession: (sessionKey: string, patch: SessionPatchUpdate) => Promise<unknown>
  ) {}

  syncSelectedSessionPreferences = (): void => {
    const inputSnapshot = useChatInputStore.getState().snapshot;
    const sessionSnapshot = useChatSessionListStore.getState().snapshot;
    const threadSnapshot = useChatThreadStore.getState().snapshot;
    const sessionKey = sessionSnapshot.selectedSessionKey;
    if (!sessionKey || !threadSnapshot.canDeleteSession) {
      return;
    }

    this.enqueue({
      sessionKey,
      patch: {
        preferredModel: normalizeOptionalModel(inputSnapshot.selectedModel),
        preferredThinking: inputSnapshot.selectedThinkingLevel ?? null
      }
    });
  };

  syncInputSelection = (params: {
    selectedSessionKey?: string | null;
    selectedSessionExists: boolean;
    selectedSessionPreferredModel?: string;
    fallbackPreferredModel?: string;
    defaultModel?: string;
    selectedSessionPreferredThinking?: ThinkingLevel | null;
    fallbackPreferredThinking?: ThinkingLevel | null;
  }) => {
    const {
      defaultModel,
      fallbackPreferredModel,
      fallbackPreferredThinking,
      selectedSessionKey = null,
      selectedSessionExists,
      selectedSessionPreferredModel,
      selectedSessionPreferredThinking,
    } = params;
    const { snapshot } = useChatInputStore.getState();
    const { modelOptions } = snapshot;
    const sessionChanged = this.previousPreferenceSessionKey !== selectedSessionKey;
    const preserveCurrentPreference = sessionChanged && Boolean(selectedSessionKey) && !selectedSessionExists;
    const selectedModel = resolveSelectedModelValue({
      currentSelectedModel: snapshot.selectedModel,
      modelOptions,
      selectedSessionPreferredModel,
      fallbackPreferredModel,
      defaultModel,
      preferSessionPreferredModel: sessionChanged,
      preserveCurrentSelectedModelOnSessionChange: preserveCurrentPreference,
    });
    const modelOption = modelOptions.find((option) => option.value === selectedModel);
    const supportedThinkingLevels =
      (modelOption?.thinkingCapability?.supported as ThinkingLevel[] | undefined) ?? [];
    const selectedThinking = resolveSelectedThinkingLevelValue({
      currentSelectedThinkingLevel: snapshot.selectedThinkingLevel,
      supportedThinkingLevels,
      selectedSessionPreferredThinking,
      fallbackPreferredThinking,
      defaultThinkingLevel:
        (modelOption?.thinkingCapability?.default as ThinkingLevel | null | undefined) ?? null,
      preferSessionPreferredThinking: sessionChanged,
      preserveCurrentSelectedThinkingOnSessionChange: preserveCurrentPreference,
    });
    if (
      snapshot.selectedModel === selectedModel &&
      snapshot.selectedThinkingLevel === selectedThinking
    ) {
      this.recordSyncedPreferenceSessionKey(selectedSessionKey, selectedSessionExists);
      return;
    }
    useChatInputStore.getState().setSnapshot({
      selectedModel,
      selectedThinkingLevel: selectedThinking,
    });
    this.recordSyncedPreferenceSessionKey(selectedSessionKey, selectedSessionExists);
  };

  private recordSyncedPreferenceSessionKey = (
    selectedSessionKey: string | null,
    selectedSessionExists: boolean,
  ): void => {
    if (!selectedSessionKey || selectedSessionExists) {
      this.previousPreferenceSessionKey = selectedSessionKey;
    }
  };

  private enqueue = (next: QueuedSessionPreferenceSync): void => {
    this.queued = next;
    if (this.inFlight) {
      return;
    }
    this.startFlush();
  };

  private startFlush = (): void => {
    this.inFlight = this.flush()
      .catch((error) => {
        console.error(`Failed to sync chat session preferences: ${String(error)}`);
      })
      .finally(() => {
        this.inFlight = null;
        if (this.queued) {
          this.startFlush();
        }
      });
  };

  private flush = async (): Promise<void> => {
    while (this.queued) {
      const current = this.queued;
      this.queued = null;
      await this.updateSession(current.sessionKey, current.patch);
    }
  };
}
