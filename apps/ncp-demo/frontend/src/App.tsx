import { useMemo, useState } from "react";
import { getOrCreateSessionId } from "./lib/session";
import { useNcpAgent } from "./hooks/use-ncp-agent";
import { SessionsPanel } from "./components/sessions-panel";
import { ChatPanel } from "./components/chat-panel";

export function App() {
  const sessionId = useMemo(() => getOrCreateSessionId(), []);
  const [draft, setDraft] = useState("");

  const agent = useNcpAgent(sessionId);

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || !agent.canSend) return;
    await agent.send(content);
    setDraft("");
  };

  return (
    <div className="demo-shell">
      <SessionsPanel
        sessionId={sessionId}
        sessions={agent.sessions}
        onRefresh={agent.refresh}
      />
      <ChatPanel
        visibleMessages={agent.visibleMessages}
        error={agent.snapshot.error ?? null}
        draft={draft}
        isSending={agent.isSending}
        canSend={agent.canSend}
        lastRunId={agent.lastRunId}
        hasActiveRun={!!agent.snapshot.activeRun?.runId}
        onDraftChange={setDraft}
        onSend={handleSend}
        onAbort={agent.abort}
        onReplay={agent.replay}
      />
    </div>
  );
}
