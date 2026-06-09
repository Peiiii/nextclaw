import type { SessionPatchUpdate, ThinkingLevel } from '@/shared/lib/api';
import type { ChatModelOption } from '@/features/chat/types/chat-input.types';
import { useChatInputStore } from '@/features/chat/stores/chat-input.store';
import { useChatSessionListStore } from '@/features/chat/stores/chat-session-list.store';
import { useChatThreadStore } from '@/features/chat/stores/chat-thread.store';
import {
  resolveSelectedModelValue,
  resolveSelectedThinkingLevelValue,
} from '@/features/chat/features/session/utils/chat-session-preference-governance.utils';

type QueuedSessionPreferenceSync = { sessionKey: string; patch: SessionPatchUpdate };

function normalizeOptionalModel(value: string): string | null {
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
    modelOptions: ChatModelOption[];
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
      modelOptions,
      selectedSessionExists,
      selectedSessionKey,
      selectedSessionPreferredModel,
      selectedSessionPreferredThinking,
    } = params;
    const { snapshot } = useChatInputStore.getState();
    const sessionChanged = this.previousPreferenceSessionKey !== selectedSessionKey;
    this.previousPreferenceSessionKey = selectedSessionKey;
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
    useChatInputStore.getState().setSnapshot({
      selectedModel,
      selectedThinkingLevel: selectedThinking,
    });
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
