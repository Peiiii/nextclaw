import { useEffect, useState } from "react";

type WorkspaceFileBufferState =
  | { contentUrl: string; status: "ready"; data: ArrayBuffer }
  | { contentUrl: string; status: "error"; data: null };

export function useWorkspaceFileBuffer(contentUrl: string): {
  status: "loading" | "ready" | "error";
  data: ArrayBuffer | null;
} {
  const [state, setState] = useState<WorkspaceFileBufferState | null>(null);
  const currentState = state?.contentUrl === contentUrl ? state : null;

  useEffect(() => {
    const abortController = new AbortController();
    void fetch(contentUrl, { signal: abortController.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Unable to load document (${response.status}).`);
        }
        return response.arrayBuffer();
      })
      .then((data) => {
        if (!abortController.signal.aborted) {
          setState({ contentUrl, status: "ready", data });
        }
      })
      .catch((error: unknown) => {
        if (!abortController.signal.aborted) {
          console.error("Failed to load workspace document", error);
          setState({ contentUrl, status: "error", data: null });
        }
      });

    return () => abortController.abort();
  }, [contentUrl]);

  return {
    status: currentState?.status ?? "loading",
    data: currentState?.data ?? null,
  };
}
