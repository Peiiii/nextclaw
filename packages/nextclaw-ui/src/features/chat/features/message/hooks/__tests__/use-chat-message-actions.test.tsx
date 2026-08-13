import { act, renderHook } from "@testing-library/react";
import type { ChatMessageViewModel } from "@nextclaw/agent-chat-ui";
import type { NcpMessage } from "@nextclaw/ncp";
import { isValidElement } from "react";
import { expect, it, vi } from "vitest";

import { useChatMessageActions } from "@/features/chat/features/message/hooks/use-chat-message-actions";

it("submits an edited message without the Web Crypto API", async () => {
  const rawMessage = {
    id: "user-editable",
    sessionId: "session-1",
    role: "user",
    status: "final",
    timestamp: "2026-08-08T10:00:00.000Z",
    parts: [{ type: "text", text: "original" }],
  } satisfies NcpMessage;
  const adaptedMessage = {
    id: rawMessage.id,
    role: "user",
    roleLabel: "You",
    timestampLabel: rawMessage.timestamp,
    parts: [{ type: "markdown", text: "original" }],
  } satisfies ChatMessageViewModel;
  const onEditMessage = vi.fn(async () => undefined);
  const { result } = renderHook(() =>
    useChatMessageActions({
      adaptedMessages: [adaptedMessage],
      canContinue: false,
      disabled: false,
      onEditMessage,
      rawMessages: [rawMessage],
    }),
  );
  const editAction = result.current.messages[0]?.actions?.find(
    (action) => action.key === "edit-message",
  );
  if (!editAction) {
    throw new Error("Expected the latest user message to be editable.");
  }

  act(() => result.current.handleMessageAction(adaptedMessage, editAction));
  const editor = result.current.renderMessageContent(adaptedMessage);
  if (!isValidElement<{ onSave: () => Promise<void> }>(editor)) {
    throw new Error("Expected the inline message editor to be rendered.");
  }

  vi.stubGlobal("crypto", undefined);
  try {
    await act(async () => editor.props.onSave());
  } finally {
    vi.unstubAllGlobals();
  }

  expect(onEditMessage).toHaveBeenCalledWith({
    messageId: rawMessage.id,
    message: expect.objectContaining({
      id: expect.stringMatching(/^edited-message-[a-z0-9]+-[a-z0-9]+$/),
      parts: rawMessage.parts,
      role: "user",
      status: "final",
    }),
  });
});
