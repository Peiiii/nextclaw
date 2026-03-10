import { ChatInputManager } from '@/components/chat/managers/chat-input.manager';
import { nextbotParsers } from '@/components/chat/chat-stream/nextbot-parsers';
import { ChatRunStatusManager } from '@/components/chat/managers/chat-run-status.manager';
import { ChatSessionListManager } from '@/components/chat/managers/chat-session-list.manager';
import { ChatStreamActionsManager } from '@/components/chat/managers/chat-stream-actions.manager';
import { ChatThreadManager } from '@/components/chat/managers/chat-thread.manager';
import { ChatUiManager } from '@/components/chat/managers/chat-ui.manager';
import { NextbotRuntimeAgent } from '@/components/chat/chat-stream/nextbot-runtime-agent';
import { AgentChatController } from '@nextclaw/agent-chat';

export class ChatPresenter {
  chatUiManager = new ChatUiManager();
  runtimeAgent = new NextbotRuntimeAgent();
  chatController = new AgentChatController(
    {
      agent: this.runtimeAgent,
      getToolDefs: () => [],
      getContexts: () => [],
      getToolExecutor: () => undefined
    },
    { metadataParsers: nextbotParsers }
  );
  chatStreamActionsManager = new ChatStreamActionsManager();
  chatInputManager = new ChatInputManager(this.chatUiManager, this.chatStreamActionsManager);
  chatSessionListManager = new ChatSessionListManager(this.chatUiManager, this.chatStreamActionsManager);
  chatRunStatusManager = new ChatRunStatusManager();
  chatThreadManager = new ChatThreadManager(
    this.chatUiManager,
    this.chatSessionListManager,
    this.chatStreamActionsManager
  );
}
