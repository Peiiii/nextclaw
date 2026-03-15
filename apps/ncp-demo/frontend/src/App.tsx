import { useEffect, useMemo, useRef, useState } from "react";
import { NcpHttpAgentClientEndpoint } from "@nextclaw/ncp-http-agent-client";
import { DefaultNcpAgentConversationStateManager } from "@nextclaw/ncp-toolkit";
import { type NcpAgentConversationSnapshot, type NcpMessagePart, NcpEventType } from "@nextclaw/ncp";

type SessionSummary = {
  sessionId: string;
  messageCount: number;
  updatedAt: string;
  status?: "idle" | "running";
  activeRunId?: string;
};

const SESSION_STORAGE_KEY = "ncp-demo-session-id";

export function App() {
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [knownRunIds, setKnownRunIds] = useState<string[]>([]);

  const sessionId = useMemo(() => getOrCreateSessionId(), []);

  const managerRef = useRef<DefaultNcpAgentConversationStateManager>();
  if (!managerRef.current) {
    managerRef.current = new DefaultNcpAgentConversationStateManager();
  }

  const [snapshot, setSnapshot] = useState<NcpAgentConversationSnapshot>(managerRef.current.getSnapshot());

  const clientRef = useRef<NcpHttpAgentClientEndpoint>();
  if (!clientRef.current) {
    clientRef.current = new NcpHttpAgentClientEndpoint({
      baseUrl: window.location.origin,
    });
  }

  useEffect(() => {
    const manager = managerRef.current;
    const client = clientRef.current;
    if (!manager || !client) {
      return;
    }

    const unsubscribeManager = manager.subscribe((nextSnapshot) => {
      setSnapshot(nextSnapshot);
    });

    const unsubscribeClient = client.subscribe((event) => {
      if (event.type === NcpEventType.RunStarted && event.payload.runId) {
        setKnownRunIds((previous) => {
          if (previous.includes(event.payload.runId!)) {
            return previous;
          }
          return [event.payload.runId!, ...previous].slice(0, 20);
        });
      }
      void manager.dispatch(event);
    });

    void refreshSessions(setSessions);
    return () => {
      unsubscribeClient();
      unsubscribeManager();
      void client.stop();
    };
  }, []);

  const canSend = !isSending && !snapshot.activeRun;

  const visibleMessages = snapshot.streamingMessage
    ? [...snapshot.messages, snapshot.streamingMessage]
    : snapshot.messages;

  const lastRunId = snapshot.activeRun?.runId ?? knownRunIds[0] ?? null;

  const send = async () => {
    const client = clientRef.current;
    if (!client) {
      return;
    }

    const content = draft.trim();
    if (!content || !canSend) {
      return;
    }

    setIsSending(true);
    try {
      await client.send({
        sessionId,
        message: {
          id: `user-${Date.now().toString(36)}`,
          sessionId,
          role: "user",
          status: "final",
          parts: [{ type: "text", text: content }],
          timestamp: new Date().toISOString(),
        },
      });
      setDraft("");
    } finally {
      setIsSending(false);
      await refreshSessions(setSessions);
    }
  };

  const abort = async () => {
    const client = clientRef.current;
    const runId = snapshot.activeRun?.runId;
    if (!client || !runId) {
      return;
    }
    await client.abort({ runId });
    await refreshSessions(setSessions);
  };

  const replay = async () => {
    const client = clientRef.current;
    if (!client || !lastRunId) {
      return;
    }
    await client.stream({ sessionId, runId: lastRunId });
  };

  return (
    <div className="demo-shell">
      <aside className="panel sessions-panel">
        <div className="panel-title">Runs</div>
        <div className="session-id">session: {sessionId}</div>
        <button className="ghost" onClick={() => refreshSessions(setSessions)}>refresh sessions</button>
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

      <main className="panel chat-panel">
        <header className="chat-header">
          <h1>NCP Agent Demo</h1>
          <div className="header-actions">
            <button className="ghost" onClick={replay} disabled={!lastRunId}>
              replay last run
            </button>
            <button className="danger" onClick={abort} disabled={!snapshot.activeRun?.runId}>
              abort
            </button>
          </div>
        </header>

        <section className="messages">
          {visibleMessages.length === 0 ? <p className="muted">Send a message to start.</p> : null}
          {visibleMessages.map((message) => (
            <article className={`message ${message.role}`} key={message.id}>
              <div className="meta">
                <span>{message.role}</span>
                <span>{message.status}</span>
              </div>
              <div className="parts">
                {message.parts.map((part, index) => (
                  <PartView key={`${message.id}-${index}`} part={part} />
                ))}
              </div>
            </article>
          ))}
        </section>

        {snapshot.error ? (
          <div className="error-box">
            {snapshot.error.code}: {snapshot.error.message}
          </div>
        ) : null}

        <footer className="composer">
          <textarea
            placeholder="Ask anything. Demo will call get_current_time tool first."
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
          />
          <button onClick={send} disabled={!canSend || draft.trim().length === 0}>
            {isSending ? "running..." : "send"}
          </button>
        </footer>
      </main>
    </div>
  );
}

function PartView(props: { part: NcpMessagePart }) {
  const { part } = props;
  if (part.type === "text") {
    return <p className="part-text">{part.text}</p>;
  }
  if (part.type === "reasoning") {
    return <p className="part-reasoning">reasoning: {part.text}</p>;
  }
  if (part.type === "tool-invocation") {
    return (
      <div className="part-tool">
        <div>tool: {part.toolName}</div>
        <pre>{JSON.stringify({ args: part.args, result: part.result }, null, 2)}</pre>
      </div>
    );
  }
  return <pre className="part-raw">{JSON.stringify(part, null, 2)}</pre>;
}

function getOrCreateSessionId(): string {
  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing && existing.trim().length > 0) {
    return existing;
  }
  const next = `demo-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(SESSION_STORAGE_KEY, next);
  return next;
}

async function refreshSessions(setter: (sessions: SessionSummary[]) => void): Promise<void> {
  const response = await fetch("/demo/sessions");
  if (!response.ok) {
    return;
  }
  const payload = (await response.json()) as SessionSummary[];
  setter(Array.isArray(payload) ? payload : []);
}
