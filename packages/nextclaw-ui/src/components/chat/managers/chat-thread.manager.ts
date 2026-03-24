import { deleteSession as deleteSessionApi } from '@/api/config';
import { useChatSessionListStore } from '@/components/chat/stores/chat-session-list.store';
import { useChatThreadStore } from '@/components/chat/stores/chat-thread.store';
import type { ChatSessionListManager } from '@/components/chat/managers/chat-session-list.manager';
import type { ChatUiManager } from '@/components/chat/managers/chat-ui.manager';
import type { ChatThreadSnapshot } from '@/components/chat/stores/chat-thread.store';
import { t } from '@/lib/i18n';
import type { ChatStreamActionsManager } from '@/components/chat/managers/chat-stream-actions.manager';

export type ChatThreadManagerActions = {
  refetchSessions: () => Promise<unknown>;
};

const noopAsync = async () => {};
export class ChatThreadManager {
  private actions: ChatThreadManagerActions = {
    refetchSessions: noopAsync
  };

  constructor(
    private uiManager: ChatUiManager,
    private sessionListManager: ChatSessionListManager,
    private streamActionsManager: ChatStreamActionsManager
  ) {}

  bindActions = (patch: Partial<ChatThreadManagerActions>) => {
    this.actions = {
      ...this.actions,
      ...patch
    };
  };

  private hasSnapshotChanges = (patch: Partial<ChatThreadSnapshot>): boolean => {
    const current = useChatThreadStore.getState().snapshot;
    for (const [key, value] of Object.entries(patch) as Array<[keyof ChatThreadSnapshot, ChatThreadSnapshot[keyof ChatThreadSnapshot]]>) {
      if (!Object.is(current[key], value)) {
        return true;
      }
    }
    return false;
  };

  syncSnapshot = (patch: Partial<ChatThreadSnapshot>) => {
    if (!this.hasSnapshotChanges(patch)) {
      return;
    }
    useChatThreadStore.getState().setSnapshot(patch);
  };

  deleteSession = () => {
    void this.deleteCurrentSession();
  };

  createSession = () => {
    this.sessionListManager.createSession();
  };

  goToProviders = () => {
    this.uiManager.goToProviders();
  };

  private deleteCurrentSession = async () => {
    const {
      snapshot: { selectedSessionKey }
    } = useChatSessionListStore.getState();
    if (!selectedSessionKey) {
      return;
    }
    const confirmed = await this.uiManager.confirm({
      title: t('chatDeleteSessionConfirm'),
      variant: 'destructive',
      confirmLabel: t('delete')
    });
    if (!confirmed) {
      return;
    }
    useChatThreadStore.getState().setSnapshot({ isDeletePending: true });
    try {
      await deleteSessionApi(selectedSessionKey);
      this.streamActionsManager.resetStreamState();
      this.uiManager.goToChatRoot({ replace: true });
      await this.actions.refetchSessions();
    } finally {
      useChatThreadStore.getState().setSnapshot({ isDeletePending: false });
    }
  };
}
