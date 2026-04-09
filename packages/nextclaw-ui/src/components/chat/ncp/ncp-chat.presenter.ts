import { ChatSessionListManager } from '@/components/chat/managers/chat-session-list.manager';
import { ChatStreamActionsManager } from '@/components/chat/managers/chat-stream-actions.manager';
import { ChatUiManager } from '@/components/chat/managers/chat-ui.manager';
import { NcpChatInputManager } from '@/components/chat/ncp/ncp-chat-input.manager';
import { NcpChatThreadManager } from '@/components/chat/ncp/ncp-chat-thread.manager';

export class NcpChatPresenter {
  chatUiManager = new ChatUiManager();
  chatStreamActionsManager = new ChatStreamActionsManager();
  chatSessionListManager = new ChatSessionListManager(this.chatUiManager, this.chatStreamActionsManager);
  chatInputManager = new NcpChatInputManager(
    this.chatUiManager,
    this.chatStreamActionsManager,
    this.chatSessionListManager
  );
  chatThreadManager = new NcpChatThreadManager(
    this.chatUiManager,
    this.chatSessionListManager,
    this.chatStreamActionsManager
  );
}
