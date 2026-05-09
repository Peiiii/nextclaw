import type { NcpSessionApi, NcpSessionSummary } from "@nextclaw/ncp";
import type { UiServerEvent } from "@nextclaw/server";

export type NcpSessionRealtimeChange =
  | {
      kind: "upsert";
      summary: NcpSessionSummary;
    }
  | {
      kind: "delete";
      sessionKey: string;
    };

export function toNcpSessionRealtimeEvent(change: NcpSessionRealtimeChange): UiServerEvent {
  if (change.kind === "upsert") {
    return {
      type: "session.summary.upsert",
      payload: {
        summary: change.summary,
      },
    };
  }

  return {
    type: "session.summary.delete",
    payload: {
      sessionKey: change.sessionKey,
    },
  };
}

export function createNcpSessionRealtimeChangePublisher(params: {
  sessionApi: Pick<NcpSessionApi, "getSession">;
  publishUiEvent?: (event: UiServerEvent) => void;
}) {
  return {
    publishSessionChange: async (sessionKey: string): Promise<void> => {
      const normalizedSessionKey = sessionKey.trim();
      if (!normalizedSessionKey) {
        return;
      }

      const summary = await params.sessionApi.getSession(normalizedSessionKey);
      params.publishUiEvent?.(
        toNcpSessionRealtimeEvent(
          summary
            ? {
                kind: "upsert",
                summary,
              }
            : {
                kind: "delete",
                sessionKey: normalizedSessionKey,
              },
        ),
      );
    },
  };
}
