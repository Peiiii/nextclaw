export type ChatComposerFileReferenceIntent = {
  id: number;
  targetSessionKey: string | null;
  tokenKey: string;
  label: string;
};

type ChatComposerIntentListener = (intent: ChatComposerFileReferenceIntent) => void;

type ChatComposerIntentSubscription = {
  targetSessionKey: string | null;
  listener: ChatComposerIntentListener;
};

export class ChatComposerIntentManager {
  private nextId = 0;
  private pendingIntent: ChatComposerFileReferenceIntent | null = null;
  private readonly subscriptions = new Set<ChatComposerIntentSubscription>();

  requestFileReference = (params: {
    targetSessionKey: string | null;
    tokenKey: string;
    label: string;
  }) => {
    const tokenKey = params.tokenKey.trim();
    const label = params.label.trim();
    if (!tokenKey || !label) {
      return;
    }
    const intent: ChatComposerFileReferenceIntent = {
      id: this.nextId + 1,
      targetSessionKey: params.targetSessionKey?.trim() || null,
      tokenKey,
      label,
    };
    this.nextId = intent.id;
    this.pendingIntent = intent;
    this.subscriptions.forEach((subscription) => {
      if (subscription.targetSessionKey === intent.targetSessionKey) {
        subscription.listener(intent);
      }
    });
  };

  consumePending = (
    targetSessionKey: string | null,
  ): ChatComposerFileReferenceIntent | null => {
    if (this.pendingIntent?.targetSessionKey !== targetSessionKey) {
      return null;
    }
    const intent = this.pendingIntent;
    this.pendingIntent = null;
    return intent;
  };

  markConsumed = (intentId: number) => {
    if (this.pendingIntent?.id === intentId) {
      this.pendingIntent = null;
    }
  };

  subscribe = (
    targetSessionKey: string | null,
    listener: ChatComposerIntentListener,
  ) => {
    const subscription = { targetSessionKey, listener };
    this.subscriptions.add(subscription);
    return () => {
      this.subscriptions.delete(subscription);
    };
  };
}
