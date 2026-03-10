import type { ChatStreamActions } from '@/components/chat/chat-stream/types';

const noopAsync = async () => {};
const noop = () => {};

export class ChatStreamActionsManager {
  private actions: ChatStreamActions = {
    sendMessage: noopAsync,
    stopCurrentRun: noopAsync,
    resumeRun: noopAsync,
    resetStreamState: noop,
    applyHistoryMessages: noop
  };

  bind = (patch: Partial<ChatStreamActions>) => {
    this.actions = {
      ...this.actions,
      ...patch
    };
  };

  sendMessage = (payload: Parameters<ChatStreamActions['sendMessage']>[0]) => this.actions.sendMessage(payload);

  stopCurrentRun = () => this.actions.stopCurrentRun();

  resumeRun = (run: Parameters<ChatStreamActions['resumeRun']>[0]) => this.actions.resumeRun(run);

  resetStreamState = () => this.actions.resetStreamState();

  applyHistoryMessages = (
    messages: Parameters<ChatStreamActions['applyHistoryMessages']>[0],
    options?: Parameters<ChatStreamActions['applyHistoryMessages']>[1]
  ) => this.actions.applyHistoryMessages(messages, options);
}
