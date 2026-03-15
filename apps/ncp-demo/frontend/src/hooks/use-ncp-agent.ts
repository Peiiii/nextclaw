import { useEffect, useRef, useState } from "react";
import { NcpHttpAgentClientEndpoint } from "@nextclaw/ncp-http-agent-client";
import { DefaultNcpAgentConversationStateManager } from "@nextclaw/ncp-toolkit";
import { type NcpAgentConversationSnapshot, type NcpMessage, NcpEventType } from "@nextclaw/ncp";
import type { SessionSummary } from "../lib/session";
import { refreshSessions } from "../lib/session";

export function useNcpAgent(sessionId: string) {
  const managerRef = useRef<DefaultNcpAgentConversationStateManager>();
  if (!managerRef.current) {
    managerRef.current = new DefaultNcpAgentConversationStateManager();
  }
  const [snapshot, setSnapshot] = useState<NcpAgentConversationSnapshot>(
    () => managerRef.current!.getSnapshot(),
  );
  const [knownRunIds, setKnownRunIds] = useState<string[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [isSending, setIsSending] = useState(false);

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

  const visibleMessages: readonly NcpMessage[] = snapshot.streamingMessage
    ? [...snapshot.messages, snapshot.streamingMessage]
    : snapshot.messages;

  const lastRunId = snapshot.activeRun?.runId ?? knownRunIds[0] ?? null;
  const canSend = !isSending && !snapshot.activeRun;

  const send = async (content: string) => {
    const client = clientRef.current;
    if (!client || !content.trim() || !canSend) {
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
          parts: [{ type: "text", text: content.trim() }],
          timestamp: new Date().toISOString(),
        },
      });
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

  const refresh = () => void refreshSessions(setSessions);

  return {
    snapshot,
    visibleMessages,
    lastRunId,
    canSend,
    isSending,
    sessions,
    send,
    abort,
    replay,
    refresh,
  };
}
