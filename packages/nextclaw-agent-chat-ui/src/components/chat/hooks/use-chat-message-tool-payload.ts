import { useEffect, useState } from "react";
import type { ChatMessageToolPayloadState } from "@agent-chat-ui/components/chat/view-models/chat-ui.types";

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
  const [pendingProcessOpen, setPendingProcessOpen] = useState(false);
  const [pendingToolGroupKey, setPendingToolGroupKey] = useState<string | null>(null);
  const payloadReady = state === undefined || state === "ready";

  useEffect(() => {
    if (!payloadReady) return;
    if (pendingProcessOpen) {
      setProcessOpen(true);
      setPendingProcessOpen(false);
    }
    if (pendingToolGroupKey) {
      setOpenToolGroupKeys((current) => new Set(current).add(pendingToolGroupKey));
      setProcessOpen(true);
      setPendingToolGroupKey(null);
    }
  }, [payloadReady, pendingProcessOpen, pendingToolGroupKey]);

  const requestPayload = () => {
    if (state === "summary" || state === "error") void onRequest?.(messageId);
  };
  const handleProcessToggle = () => {
    if (processOpen) return setProcessOpen(false);
    if (payloadReady) return setProcessOpen(true);
    setPendingProcessOpen(true);
    requestPayload();
  };
  const handleToolActivityOpenChange = (groupKey: string, open: boolean) => {
    if (open && !payloadReady) {
      setPendingToolGroupKey(groupKey);
      requestPayload();
      return;
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
    openToolGroupKeys,
    processOpen,
  };
}
