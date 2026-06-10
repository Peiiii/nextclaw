import { ChatSessionListManager } from '@/features/chat/managers/chat-session-list.manager';
import { ChatStreamActionsManager } from '@/features/chat/managers/chat-stream-actions.manager';
import { ChatUiManager } from '@/features/chat/managers/chat-ui.manager';
import { NcpChatInputManager } from '@/features/chat/managers/ncp-chat-input.manager';
import { NcpChatQueryManager } from '@/features/chat/managers/ncp-chat-query.manager';
import { NcpChatThreadManager } from '@/features/chat/managers/ncp-chat-thread.manager';
import type { AppPresenter } from '@/app/presenters/app.presenter';

export class NcpChatPresenter {
  readonly chatUiManager: ChatUiManager;
  readonly chatStreamActionsManager: ChatStreamActionsManager;
  readonly chatSessionListManager: ChatSessionListManager;
  readonly chatInputManager: NcpChatInputManager;
  readonly chatQueryManager: NcpChatQueryManager;
  readonly chatThreadManager: NcpChatThreadManager;

  constructor(appPresenter: AppPresenter) {
    this.chatUiManager = new ChatUiManager();
    this.chatStreamActionsManager = new ChatStreamActionsManager();
    this.chatSessionListManager = new ChatSessionListManager(this.chatUiManager, this.chatStreamActionsManager);
    this.chatQueryManager = new NcpChatQueryManager();
    this.chatInputManager = new NcpChatInputManager(
      this.chatUiManager,
      this.chatStreamActionsManager,
      this.chatSessionListManager
    );
    this.chatThreadManager = new NcpChatThreadManager(
      this.chatUiManager,
      this.chatSessionListManager,
      this.chatStreamActionsManager,
      appPresenter.docBrowserManager
    );
  }

  startAgentCreationDraft = (prompt: string) => {
    this.chatSessionListManager.createSession();
    this.chatSessionListManager.setSelectedAgentId('main');
    this.chatInputManager.setDraft(prompt);
    this.chatInputManager.requestComposerFocusAtEnd();
  };
}
