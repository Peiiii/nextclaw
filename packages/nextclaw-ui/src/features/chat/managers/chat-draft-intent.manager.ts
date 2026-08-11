import type { SystemObjectResolvedReference } from '@nextclaw/shared';

export type ChatDraftIntent = {
  id: number;
} & (
  | { kind: 'prompt'; prompt: string }
  | { kind: 'system-object-reference'; reference: SystemObjectResolvedReference }
);

type ChatDraftIntentListener = (intent: ChatDraftIntent) => void;

export class ChatDraftIntentManager {
  private nextId = 0;
  private pendingIntent: ChatDraftIntent | null = null;
  private readonly listeners = new Set<ChatDraftIntentListener>();

  requestDraft = (prompt: string) => {
    const normalizedPrompt = prompt.trim();
    if (!normalizedPrompt) {
      return;
    }
    const intent: ChatDraftIntent = {
      id: this.nextId + 1,
      kind: 'prompt',
      prompt: normalizedPrompt,
    };
    this.nextId = intent.id;
    this.pendingIntent = intent;
    this.listeners.forEach((listener) => listener(intent));
  };

  requestSystemObjectReference = (reference: SystemObjectResolvedReference) => {
    const intent: ChatDraftIntent = {
      id: this.nextId + 1,
      kind: 'system-object-reference',
      reference: structuredClone(reference),
    };
    this.nextId = intent.id;
    this.pendingIntent = intent;
    this.listeners.forEach((listener) => listener(intent));
  };

  consumePending = (): ChatDraftIntent | null => {
    const intent = this.pendingIntent;
    this.pendingIntent = null;
    return intent;
  };

  markConsumed = (intentId: number) => {
    if (this.pendingIntent?.id !== intentId) {
      return;
    }
    this.pendingIntent = null;
  };

  subscribe = (listener: ChatDraftIntentListener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}
