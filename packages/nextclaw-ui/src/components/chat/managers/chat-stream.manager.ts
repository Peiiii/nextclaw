import type { ChatRunView } from '@/api/types';
import { ChatStreamRuntimeController } from '@/components/chat/chat-stream/chat-stream-runtime-controller';
import type { SendMessageParams, UseChatStreamControllerParams } from '@/components/chat/chat-stream/types';

const DEFAULT_PARAMS: UseChatStreamControllerParams = {
  nextOptimisticUserSeq: 1,
  selectedSessionKeyRef: { current: null },
  setSelectedSessionKey: () => {},
  setDraft: () => {},
  refetchSessions: async () => {},
  refetchHistory: async () => {}
};

export class ChatStreamManager {
  private runtimeController: ChatStreamRuntimeController;

  constructor(params: UseChatStreamControllerParams = DEFAULT_PARAMS) {
    this.runtimeController = new ChatStreamRuntimeController(params);
  }

  updateParams = (next: UseChatStreamControllerParams) => {
    this.runtimeController.updateParams(next);
  };

  getSnapshot = () => this.runtimeController.getSnapshot();

  subscribe = (onStoreChange: () => void) => this.runtimeController.subscribe(onStoreChange);

  destroy = () => {
    this.runtimeController.destroy();
  };

  sendMessage = async (payload: SendMessageParams) => {
    await this.runtimeController.sendMessage(payload);
  };

  resumeRun = async (run: ChatRunView) => {
    await this.runtimeController.resumeRun(run);
  };

  stopCurrentRun = async (options?: { clearQueue?: boolean }) => {
    await this.runtimeController.stopCurrentRun(options);
  };

  removeQueuedMessage = (id: number) => {
    this.runtimeController.removeQueuedMessage(id);
  };

  promoteQueuedMessage = (id: number) => {
    this.runtimeController.promoteQueuedMessage(id);
  };

  resetStreamState = () => {
    this.runtimeController.resetStreamState();
  };
}
