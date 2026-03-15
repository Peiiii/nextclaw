import type { SessionSummary } from "../lib/session";

type SessionsPanelProps = {
  sessionId: string;
  sessions: SessionSummary[];
  onRefresh: () => void;
};

export function SessionsPanel({ sessionId, sessions, onRefresh }: SessionsPanelProps) {
  return (
    <aside className="panel sessions-panel">
      <div className="panel-title">Runs</div>
      <div className="session-id">session: {sessionId}</div>
      <button className="ghost" onClick={onRefresh}>
        refresh sessions
      </button>
      <div className="session-list">
        {sessions.length === 0 ? <p className="muted">No sessions yet.</p> : null}
        {sessions.map((session) => (
          <div className="session-card" key={session.sessionId}>
            <div>{session.sessionId}</div>
            <div className="muted">{session.messageCount} messages</div>
            <div className="muted">{session.status ?? "idle"}</div>
          </div>
        ))}
      </div>
    </aside>
  );
}
