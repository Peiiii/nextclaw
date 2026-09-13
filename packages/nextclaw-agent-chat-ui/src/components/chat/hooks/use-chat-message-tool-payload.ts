import { useState } from "react";
import type { ChatMessageToolPayloadState } from "@agent-chat-ui/components/chat/view-models/chat-ui.types";

const CLOSED_TOOL_GROUPS: ReadonlySet<string> = new Set();

export function useChatMessageToolPayload(params: {
  messageId: string;
  state?: ChatMessageToolPayloadState;
  onRequest?: (messageId: string) => Promise<void> | void;
}) {
  const { messageId, onRequest, state } = params;
  const [processOpen, setProcessOpen] = useState(false);
  const [openToolGroupKeys, setOpenToolGroupKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const payloadReady = state === undefined || state === "ready";

  const requestPayload = () => {
    if (state === "summary" || state === "error") void onRequest?.(messageId);
  };
  const handleProcessToggle = () => {
    if (processOpen) {
      return setProcessOpen(false);
    }
    setProcessOpen(true);
    requestPayload();
  };
  const handleToolActivityOpenChange = (groupKey: string, open: boolean) => {
    if (open && !payloadReady) {
      requestPayload();
    }
    setOpenToolGroupKeys((current) => {
      const next = new Set(current);
      if (open) next.add(groupKey);
      else next.delete(groupKey);
      return next;
    });
    if (open) setProcessOpen(true);
  };

  return {
    handleProcessToggle,
    handleToolActivityOpenChange,
    openToolGroupKeys: payloadReady ? openToolGroupKeys : CLOSED_TOOL_GROUPS,
    processOpen,
  };
}
