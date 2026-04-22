import type { SessionPatchUpdate, ThinkingLevel } from '@/shared/lib/api';
import { useChatInputStore } from '@/features/chat/stores/chat-input.store';
import { useChatSessionListStore } from '@/features/chat/stores/chat-session-list.store';
import { useChatThreadStore } from '@/features/chat/stores/chat-thread.store';

type QueuedSessionPreferenceSync = { sessionKey: string; patch: SessionPatchUpdate };

function normalizeOptionalModel(value: string): string | null {
  const normalized = value.trim(); return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalThinking(value: ThinkingLevel | null): ThinkingLevel | null {
  return value ?? null;
}

export class ChatSessionPreferenceSync {
  private inFlight: Promise<void> | null = null;
  private queued: QueuedSessionPreferenceSync | null = null;

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
        preferredThinking: normalizeOptionalThinking(inputSnapshot.selectedThinkingLevel)
      }
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
