import type { NcpMessage, NcpError } from "@nextclaw/ncp";
import { ErrorBox } from "../ui/error-box";
import { MessageBubble } from "../ui/message-bubble";

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
      <header className="chat-header">
        <h1>NCP Agent Demo</h1>
        <div className="header-actions">
          <button className="ghost" onClick={onReplay} disabled={!lastRunId}>
            replay last run
          </button>
          <button className="danger" onClick={onAbort} disabled={!hasActiveRun}>
            abort
          </button>
        </div>
      </header>

      <section className="messages">
        {visibleMessages.length === 0 ? <p className="muted">Send a message to start.</p> : null}
        {visibleMessages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </section>

      <ErrorBox error={error} />

      <footer className="composer">
        <textarea
          placeholder="Ask anything. Demo will call get_current_time tool first."
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void onSend();
            }
          }}
        />
        <button onClick={onSend} disabled={!canSend || draft.trim().length === 0}>
          {isSending ? "running..." : "send"}
        </button>
      </footer>
    </main>
  );
}
