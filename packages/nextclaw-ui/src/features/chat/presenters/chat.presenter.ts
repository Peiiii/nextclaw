import { ChatSessionListManager } from '@/features/chat/managers/chat-session-list.manager';
import { ChatRunManager } from '@/features/chat/managers/chat-run.manager';
import { ChatUiManager } from '@/features/chat/managers/chat-ui.manager';
import { ChatInputManager } from '@/features/chat/managers/chat-input.manager';
import { ChatQueryManager } from '@/features/chat/managers/chat-query.manager';
import { ChatThreadManager } from '@/features/chat/managers/chat-thread.manager';
import type { AppPresenter } from '@/app/presenters/app.presenter';

export class ChatPresenter {
  readonly chatUiManager: ChatUiManager;
  readonly chatRunManager: ChatRunManager;
  readonly chatSessionListManager: ChatSessionListManager;
  readonly chatInputManager: ChatInputManager;
  readonly chatQueryManager: ChatQueryManager;
  readonly chatThreadManager: ChatThreadManager;

  constructor(appPresenter: AppPresenter) {
    this.chatUiManager = new ChatUiManager(appPresenter.docBrowserManager);
    this.chatRunManager = new ChatRunManager(this.chatUiManager);
    this.chatSessionListManager = new ChatSessionListManager(this.chatUiManager, this.chatRunManager);
    this.chatQueryManager = new ChatQueryManager();
    this.chatInputManager = new ChatInputManager(
      this.chatRunManager,
      this.chatSessionListManager
    );
    this.chatThreadManager = new ChatThreadManager(
      this.chatUiManager,
      this.chatSessionListManager,
      this.chatRunManager
    );
  }

  startAgentCreationDraft = (prompt: string) => {
    this.chatSessionListManager.createSession();
    this.chatSessionListManager.setSelectedAgentId('main');
    this.chatInputManager.setDraft(prompt);
    this.chatInputManager.requestComposerFocusAtEnd();
  };
}
