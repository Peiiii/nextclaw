import { ChatSessionListManager } from '@/features/chat/managers/chat-session-list.manager';
import { ChatUiManager } from '@/features/chat/managers/chat-ui.manager';
import { ChatQueryManager } from '@/features/chat/managers/chat-query.manager';
import { ChatThreadManager } from '@/features/chat/managers/chat-thread.manager';
import type { AppPresenter } from '@/app/presenters/app.presenter';

export class ChatPresenter {
  readonly chatUiManager: ChatUiManager;
  readonly chatSessionListManager: ChatSessionListManager;
  readonly chatQueryManager: ChatQueryManager;
  readonly chatThreadManager: ChatThreadManager;

  constructor(appPresenter: AppPresenter) {
    this.chatUiManager = new ChatUiManager(appPresenter.docBrowserManager);
    this.chatSessionListManager = new ChatSessionListManager(this.chatUiManager);
    this.chatQueryManager = new ChatQueryManager();
    this.chatThreadManager = new ChatThreadManager(
      this.chatUiManager,
      this.chatSessionListManager,
      appPresenter.notifyRightPanelOpened,
    );
  }
}
