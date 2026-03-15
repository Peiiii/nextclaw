type ChatHeaderProps = {
  title: string;
  replayDisabled: boolean;
  abortDisabled: boolean;
  onReplay: () => void;
  onAbort: () => void;
};

export function ChatHeader({
  title,
  replayDisabled,
  abortDisabled,
  onReplay,
  onAbort,
}: ChatHeaderProps) {
  return (
    <header className="chat-header">
      <h1>{title}</h1>
      <div className="header-actions">
        <button className="ghost" onClick={onReplay} disabled={replayDisabled}>
          replay last run
        </button>
        <button className="danger" onClick={onAbort} disabled={abortDisabled}>
          abort
        </button>
      </div>
    </header>
  );
}
