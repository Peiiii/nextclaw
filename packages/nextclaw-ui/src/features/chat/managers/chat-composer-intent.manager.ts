import {
  CHAT_WORKSPACE_EXCERPT_TOKEN_KIND,
  CHAT_WORKSPACE_FILE_TOKEN_KIND,
} from "@nextclaw/shared";

type ChatComposerReferenceIntentBase = {
  id: number;
  targetSessionKey: string | null;
  tokenKey: string;
  label: string;
};

export type ChatComposerFileReferenceIntent = ChatComposerReferenceIntentBase & {
  kind: typeof CHAT_WORKSPACE_FILE_TOKEN_KIND;
};

export type ChatComposerExcerptReferenceIntent = ChatComposerReferenceIntentBase & {
  kind: typeof CHAT_WORKSPACE_EXCERPT_TOKEN_KIND;
  path: string;
  excerpt: string;
  startLine: number | null;
  endLine: number | null;
};

export type ChatComposerReferenceIntent =
  | ChatComposerFileReferenceIntent
  | ChatComposerExcerptReferenceIntent;

type ChatComposerReferenceRequest =
  | Omit<ChatComposerFileReferenceIntent, "id">
  | Omit<ChatComposerExcerptReferenceIntent, "id">;

type ChatComposerIntentListener = (intent: ChatComposerReferenceIntent) => void;

type ChatComposerIntentSubscription = {
  targetSessionKey: string | null;
  listener: ChatComposerIntentListener;
};

export class ChatComposerIntentManager {
  private nextId = 0;
  private pendingIntent: ChatComposerReferenceIntent | null = null;
  private readonly subscriptions = new Set<ChatComposerIntentSubscription>();

  private publish = (intent: ChatComposerReferenceRequest) => {
    const id = this.nextId + 1;
    const targetSessionKey = intent.targetSessionKey?.trim() || null;
    const nextIntent: ChatComposerReferenceIntent = intent.kind === CHAT_WORKSPACE_FILE_TOKEN_KIND
      ? { ...intent, id, targetSessionKey }
      : { ...intent, id, targetSessionKey };
    this.nextId = nextIntent.id;
    this.pendingIntent = nextIntent;
    this.subscriptions.forEach((subscription) => {
      if (subscription.targetSessionKey === nextIntent.targetSessionKey) {
        subscription.listener(nextIntent);
      }
    });
  };

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
    this.publish({
      kind: CHAT_WORKSPACE_FILE_TOKEN_KIND,
      targetSessionKey: params.targetSessionKey?.trim() || null,
      tokenKey,
      label,
    });
  };

  requestExcerptReference = (params: {
    targetSessionKey: string | null;
    path: string;
    label: string;
    excerpt: string;
    startLine: number | null;
    endLine: number | null;
  }) => {
    const {
      endLine,
      excerpt: rawExcerpt,
      label: rawLabel,
      path: rawPath,
      startLine,
      targetSessionKey,
    } = params;
    const path = rawPath.trim();
    const label = rawLabel.trim();
    const excerpt = rawExcerpt.trim();
    if (!path || !label || !excerpt) {
      return;
    }
    const identity = `${path}:${startLine ?? "x"}:${endLine ?? "x"}:${excerpt}`;
    let hash = 2166136261;
    for (let index = 0; index < identity.length; index += 1) {
      hash ^= identity.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    this.publish({
      kind: CHAT_WORKSPACE_EXCERPT_TOKEN_KIND,
      targetSessionKey,
      tokenKey: `${path}#excerpt-${(hash >>> 0).toString(36)}`,
      path,
      label,
      excerpt,
      startLine,
      endLine,
    });
  };

  consumePending = (
    targetSessionKey: string | null,
  ): ChatComposerReferenceIntent | null => {
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
