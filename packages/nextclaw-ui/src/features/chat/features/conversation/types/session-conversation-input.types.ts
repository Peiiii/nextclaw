import type { ChatContextWindowIndicator } from '@nextclaw/agent-chat-ui';
import type { SessionConversationQueuedInput } from '@/features/chat/features/conversation/hooks/use-session-conversation-controller';
import type { useSessionConversationInputQuery } from '@/features/chat/features/conversation/hooks/use-session-conversation-input-query';
import type {
  SessionConversationInputActions,
  SessionConversationInputSnapshot,
} from '@/features/chat/features/conversation/hooks/use-session-conversation-input-state';

export type SessionConversationInputController = {
  readonly canEditQueuedInput: boolean;
  readonly canStopGeneration: boolean;
  readonly deleteQueuedInput: (id: string) => void;
  readonly editQueuedInput: (id: string) => void;
  readonly isSending: boolean;
  readonly queuedInputs: readonly SessionConversationQueuedInput[];
  readonly primaryAction: 'continue' | 'send';
  readonly sendDisabled: boolean;
  readonly stopDisabled: boolean;
  readonly send: () => Promise<void> | void;
  readonly sendSteering: () => Promise<void> | void;
  readonly sendPresetMessage: (message: string) => Promise<void> | void;
  readonly retryPendingSubmission: () => Promise<void> | void;
  readonly restorePendingSubmission: () => void;
  readonly discardPendingSubmission: () => void;
  readonly stop: () => Promise<void> | void;
  readonly steerQueuedInput: (id: string) => void;
};

export type SessionConversationInputProps = {
  readonly contextWindow: ChatContextWindowIndicator | null;
  readonly controller: SessionConversationInputController;
  readonly inputActions: SessionConversationInputActions;
  readonly inputQuery: ReturnType<typeof useSessionConversationInputQuery>;
  readonly inputSnapshot: SessionConversationInputSnapshot;
  readonly onContextCompactingChange?: (sessionId: string, isCompacting: boolean) => void;
  readonly placeholder?: string;
  readonly surface?: 'default' | 'embedded';
};
