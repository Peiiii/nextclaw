import type { NcpMessage, NcpError } from "@nextclaw/ncp";
import { ChatHeader } from "../ui/chat-header";
import { ChatInput } from "../ui/chat-input";
import { ErrorBox } from "../ui/error-box";
import { MessageList } from "../ui/message-list";

type ChatPanelProps = {
  visibleMessages: readonly NcpMessage[];
  error: NcpError | null;
  draft: string;
  isSending: boolean;
  canSend: boolean;
  lastRunId: string | null;
  hasActiveRun: boolean;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onAbort: () => void;
  onReplay: () => void;
};

export function ChatPanel({
  visibleMessages,
  error,
  draft,
  isSending,
  canSend,
  lastRunId,
  hasActiveRun,
  onDraftChange,
  onSend,
  onAbort,
  onReplay,
}: ChatPanelProps) {
  return (
    <main className="panel chat-panel">
      <ChatHeader
        title="NCP Agent Demo"
        replayDisabled={!lastRunId}
        abortDisabled={!hasActiveRun}
        onReplay={onReplay}
        onAbort={onAbort}
      />
      <MessageList messages={visibleMessages} emptyMessage="Send a message to start." />
      <ErrorBox error={error} />
      <ChatInput
        value={draft}
        placeholder="Ask anything. Demo will call get_current_time tool first."
        isSending={isSending}
        canSend={canSend}
        onChange={onDraftChange}
        onSend={onSend}
      />
    </main>
  );
}
